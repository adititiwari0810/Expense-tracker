/**
 * API client with retry logic and error handling.
 *
 * Implements exponential backoff for transient failures.
 * All API calls go through this module.
 */

const API_BASE = '/api';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Make an API request with retry logic.
 * Retries on 5xx errors and network failures.
 * Does NOT retry on 4xx (client errors).
 */
async function apiRequest(url, options = {}, retries = MAX_RETRIES) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${API_BASE}${url}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });

      const data = await response.json();

      // 4xx errors — don't retry, it's a client problem
      if (response.status >= 400 && response.status < 500) {
        throw new ApiError(data.error || 'Request failed', response.status, data);
      }

      // 5xx errors — retry
      if (response.status >= 500) {
        throw new ApiError(data.error || 'Server error', response.status, data);
      }

      return { data, status: response.status };
    } catch (err) {
      lastError = err;

      // Don't retry client errors (4xx)
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        throw err;
      }

      // If we have retries left, wait with exponential backoff
      if (attempt < retries) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`API request failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Create an expense. POST is idempotent via idempotency_key.
 * Safe to retry — duplicate key returns existing record.
 */
export async function createExpense({ idempotency_key, amount, category, description, date }) {
  return apiRequest('/expenses', {
    method: 'POST',
    body: JSON.stringify({ idempotency_key, amount, category, description, date }),
  });
}

/**
 * Fetch expenses with optional category filter.
 */
export async function fetchExpenses({ category } = {}) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  params.set('sort', 'date_desc');

  const query = params.toString();
  return apiRequest(`/expenses${query ? `?${query}` : ''}`);
}

export { ApiError };
