# Expense Tracker

A production-grade personal finance tool for recording and reviewing expenses.  
Built with correctness-first principles: **idempotent writes**, **integer-cent money**, and **retry-safe API design**.

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Client (React + Vite)              │
│  ┌──────────┐ ┌────────────┐ ┌───────────────────┐  │
│  │  Form    │ │  List +    │ │  Filter + Total   │  │
│  │  (UUID)  │ │  Table     │ │  (SQL SUM)        │  │
│  └────┬─────┘ └─────┬──────┘ └────────┬──────────┘  │
│       │             │                 │              │
│  ┌────▼─────────────▼─────────────────▼──────────┐  │
│  │  API Client  (exponential backoff, 3 retries) │  │
│  └───────────────────┬───────────────────────────┘  │
└──────────────────────┼──────────────────────────────┘
                       │  HTTP (JSON)
┌──────────────────────┼──────────────────────────────┐
│                  Server (Express)                   │
│  ┌───────────────────▼───────────────────────────┐  │
│  │  Routes  →  Service  →  Model  →  SQLite DB   │  │
│  │                                               │  │
│  │  Idempotency enforced at DB level via UNIQUE  │  │
│  │  constraint on idempotency_key column.        │  │
│  └───────────────────────────────────────────────┘  │
│  Static file server (serves React build in prod)    │
└─────────────────────────────────────────────────────┘
```

**Monorepo layout:**

```
expense-tracker/
├── backend/              # Express API + SQLite
│   └── src/
│       ├── index.js      # Entry point, middleware, static serving
│       ├── db/           # Database init, migrations, WAL mode
│       ├── models/       # Data access (prepared statements)
│       ├── services/     # Business logic (idempotency flow)
│       ├── routes/       # HTTP handlers (thin, delegates to service)
│       ├── utils/        # Validation, structured logger
│       └── tests/        # Unit + integration tests (node:test)
├── frontend/             # React + Vite
│   └── src/
│       ├── components/   # ExpenseForm, ExpenseList, FilterBar
│       ├── hooks/        # useExpenses (state management)
│       └── utils/        # API client (retry logic), money helpers
└── README.md
```

---

## Key Design Decisions

### 1. Idempotency Strategy

**Problem:** Users may click submit multiple times, refresh after submitting, or experience network timeouts that trigger automatic retries. Without idempotency, each retry creates a duplicate expense.

**Solution:**

1. The frontend generates a **UUID v4** (`crypto.randomUUID()`) when the form mounts.
2. This UUID is sent as `idempotency_key` with every POST request.
3. The database enforces a `UNIQUE` constraint on `idempotency_key`.
4. On duplicate insert attempt:
   - SQLite raises `SQLITE_CONSTRAINT_UNIQUE`.
   - The service catches this, looks up the existing record, and returns it with `{ duplicate: true }` and HTTP `200`.
5. A **new UUID is generated only after confirmed success**, ensuring retries of a failed submission reuse the same key.

**Why this works:**
- The UNIQUE constraint is enforced **atomically at the database level** — no race conditions.
- SQLite serializes all writes (single-writer model), so concurrent duplicate POSTs are safely handled.
- The client never needs to check for duplicates; the server handles it transparently.
- The API consumer can retry indefinitely without risk.

### 2. Money Handling (Integer Cents)

**Problem:** IEEE 754 floating-point arithmetic produces rounding errors (e.g., `0.1 + 0.2 !== 0.3`). Financial calculations require exact precision.

**Solution:**
- All monetary values are stored and transmitted as **integer cents** (e.g., `$12.50` → `1250`).
- The database column has `CHECK(amount > 0)` — no zero or negative amounts at the DB level.
- Conversion happens **only at the UI boundary**:
  - `dollarsToCents("12.50")` → `1250` (string manipulation, no floats).
  - `centsToDisplay(1250)` → `"$12.50"` (integer math only).
- Totals are computed via `SQL SUM()` on integer columns — no floating-point accumulation errors.

### 3. Persistence: SQLite (better-sqlite3)

**Why SQLite:**
- Zero configuration, no external services.
- ACID-compliant with WAL mode for concurrent reads.
- Synchronous API (`better-sqlite3`) eliminates callback/promise complexity.
- Prepared statements for safety and performance.
- Sufficient for single-user/small-team personal finance tool.

**Trade-offs:**
- Single-writer model limits write concurrency (acceptable for this use case).
- Not suitable for distributed multi-server deployments without external DB.

### 4. Resilience

- **Frontend retry logic:** Exponential backoff (500ms × 2^attempt) with max 3 retries.
- **Retry discrimination:** Only retries on 5xx and network errors. 4xx (validation) errors are never retried.
- **Double-click protection:** Submit button disabled during request.
- **Graceful shutdown:** `SIGTERM`/`SIGINT` handlers close DB connections cleanly.
- **Structured logging:** JSON-line format for production observability.

---

## API Reference

### `POST /api/expenses`

Create an expense (idempotent).

**Request body:**
```json
{
  "idempotency_key": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 1250,
  "category": "food",
  "description": "Lunch at cafe",
  "date": "2026-04-26"
}
```

| Field             | Type    | Required | Notes                                    |
|-------------------|---------|----------|------------------------------------------|
| `idempotency_key` | string  | yes      | UUID, must be unique per expense         |
| `amount`          | integer | yes      | Cents, > 0, max 999,999,999             |
| `category`        | string  | yes      | One of: food, transport, utilities, entertainment, healthcare, shopping, education, housing, other |
| `description`     | string  | no       | Max 500 characters                       |
| `date`            | string  | yes      | ISO 8601 date (YYYY-MM-DD)              |

**Responses:**

| Status | Meaning             | Body                                      |
|--------|----------------------|-------------------------------------------|
| `201`  | Created              | `{ expense: {...}, duplicate: false }`    |
| `200`  | Duplicate detected   | `{ expense: {...}, duplicate: true }`     |
| `400`  | Validation error     | `{ error: "...", fields: {...} }`         |
| `500`  | Server error         | `{ error: "Internal server error" }`      |

### `GET /api/expenses`

List expenses with optional filtering.

**Query parameters:**

| Param      | Type   | Default     | Notes                          |
|------------|--------|-------------|--------------------------------|
| `category` | string | —           | Filter by category (lowercase) |
| `sort`     | string | `date_desc` | Only `date_desc` supported     |

**Response:**
```json
{
  "expenses": [{ "id": 1, "amount": 1250, "category": "food", ... }],
  "total": 5849,
  "count": 3,
  "categories": ["food", "transport"]
}
```

### `GET /api/health`

```json
{ "status": "ok", "timestamp": "2026-04-26T11:00:00.000Z" }
```

---

## Local Setup

### Prerequisites
- Node.js ≥ 18.0.0
- npm

### Install & Run

```bash
# Clone the repo
git clone <your-repo-url>
cd expense-tracker

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# --- Development (two terminals) ---

# Terminal 1: Start backend (port 3001)
cd backend
npm run dev

# Terminal 2: Start frontend dev server (port 5173, proxies /api → :3001)
cd frontend
npm run dev

# Open http://localhost:5173
```

### Run Tests

```bash
cd backend
npm test
```

## Deployment (Render — Single Service)

The application is designed for **single-service deployment**: Express serves both the API and the built React frontend from `frontend/dist`.

### Option A: Render Blueprint (Recommended)

A `render.yaml` is included in the repo root. To deploy:

1. Push the repo to GitHub.
2. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**.
3. Connect your GitHub repo → Render auto-detects `render.yaml` and deploys.

### Option B: Render Web Service (Manual)

1. Push the repo to GitHub.

2. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **Web Service**.

3. Connect your GitHub repo and configure:

| Setting          | Value                                                                            |
|------------------|----------------------------------------------------------------------------------|
| Root Directory   | *(leave empty — repo root)*                                                      |
| Build Command    | `cd frontend && npm install && npm run build && cd ../backend && npm install`     |
| Start Command    | `cd backend && node src/index.js`                                                |

4. Add environment variable: `NODE_ENV` = `production`

5. Click **Deploy Web Service**.

**Environment variables reference:**

| Variable   | Default                  | Description                                  |
|------------|--------------------------|----------------------------------------------|
| `PORT`     | `3001`                   | Server port (Render sets this automatically) |
| `NODE_ENV` | `development`            | Set to `production`                          |
| `DB_PATH`  | `./data/expenses.db`     | SQLite database path                         |
| `LOG_LEVEL`| `info`                   | `debug`, `info`, `warn`, `error`             |

### Option C: Manual / Docker

```bash
# Build frontend
cd frontend
npm install
npm run build

# Start production server
cd ../backend
npm install --production
NODE_ENV=production node src/index.js

# App is now on http://localhost:3001
```

### Important: SQLite on Render

Render's free tier uses **ephemeral filesystems** — the SQLite database file will be lost on each deploy. For a persistent database:
- Use Render's **Persistent Disk** ($0.25/GB/month) mounted at `/data`, then set `DB_PATH=/data/expenses.db`.
- Or migrate to PostgreSQL for production-scale persistence.

---

## Trade-offs & Scope Decisions

| Decision | Rationale |
|----------|-----------|
| SQLite over PostgreSQL | Zero-config, ACID-compliant, perfect for single-service deployment. Trades horizontal scalability for simplicity. |
| Fixed category list | Prevents typos and normalizes data. Trades flexibility for consistency. |
| No authentication | Out of scope for a personal finance tool exercise. Would add JWT/session auth in production. |
| No pagination | Acceptable for personal expense volumes. Would add cursor-based pagination at scale. |
| No edit/delete | Intentionally omitted to keep the scope focused on correctness. Trivial to add. |
| Server-computed totals | `SUM()` in SQL is more accurate and efficient than client-side reduction over integer cents. |
| String-based dollar→cent conversion | Avoids `parseFloat` entirely — uses string splitting to prevent floating-point contamination. |

---

## What I Would Add Next

1. **Edit and delete** expenses (with soft-delete for audit trail)
2. **Category summary view** (total per category, pie chart)
3. **Pagination** (cursor-based for stable ordering)
4. **Authentication** (JWT or session-based)
5. **PostgreSQL migration** for multi-instance deployments
6. **E2E tests** (Playwright) for critical user flows
7. **Rate limiting** on POST endpoint
8. **CSV export** for tax/accounting

---

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React 19, Vite 8                   |
| Backend  | Node.js, Express 4                 |
| Database | SQLite (better-sqlite3), WAL mode  |
| Testing  | Node.js built-in test runner       |
| Styling  | Vanilla CSS, Inter font            |
