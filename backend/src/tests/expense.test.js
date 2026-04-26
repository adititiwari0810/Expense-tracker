/**
 * Tests for validation, money handling, and idempotency.
 *
 * Run: node --test src/tests/expense.test.js
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { validateExpense } = require('../utils/validation');

// ─── Validation Tests ────────────────────────────────────────

describe('validateExpense', () => {
  const validPayload = {
    idempotency_key: 'abc-123',
    amount: 1250,
    category: 'food',
    description: 'test',
    date: '2026-04-26',
  };

  it('accepts a valid expense', () => {
    const result = validateExpense(validPayload);
    assert.equal(result.valid, true);
    assert.equal(result.errors, undefined);
  });

  it('rejects missing idempotency_key', () => {
    const result = validateExpense({ ...validPayload, idempotency_key: '' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.idempotency_key);
  });

  it('rejects negative amount', () => {
    const result = validateExpense({ ...validPayload, amount: -100 });
    assert.equal(result.valid, false);
    assert.ok(result.errors.amount);
  });

  it('rejects zero amount', () => {
    const result = validateExpense({ ...validPayload, amount: 0 });
    assert.equal(result.valid, false);
    assert.ok(result.errors.amount);
  });

  it('rejects float amount', () => {
    const result = validateExpense({ ...validPayload, amount: 12.5 });
    assert.equal(result.valid, false);
    assert.ok(result.errors.amount);
  });

  it('rejects amount exceeding max', () => {
    const result = validateExpense({ ...validPayload, amount: 1_000_000_000 });
    assert.equal(result.valid, false);
    assert.ok(result.errors.amount);
  });

  it('rejects invalid category', () => {
    const result = validateExpense({ ...validPayload, category: 'invalid' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.category);
  });

  it('rejects invalid date format', () => {
    const result = validateExpense({ ...validPayload, date: '04/26/2026' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.date);
  });

  it('rejects impossible date', () => {
    const result = validateExpense({ ...validPayload, date: '2026-13-01' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.date);
  });

  it('accepts empty description', () => {
    const result = validateExpense({ ...validPayload, description: undefined });
    assert.equal(result.valid, true);
  });

  it('rejects description over 500 chars', () => {
    const result = validateExpense({ ...validPayload, description: 'x'.repeat(501) });
    assert.equal(result.valid, false);
    assert.ok(result.errors.description);
  });
});

// ─── Idempotency Tests ───────────────────────────────────────

describe('Idempotency (integration)', () => {
  const Database = require('better-sqlite3');
  const path = require('path');
  let db;

  before(() => {
    // Use in-memory DB for tests
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE expenses (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        idempotency_key TEXT    NOT NULL UNIQUE,
        amount          INTEGER NOT NULL CHECK(amount > 0),
        category        TEXT    NOT NULL,
        description     TEXT    NOT NULL DEFAULT '',
        date            TEXT    NOT NULL,
        created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
      );
    `);
  });

  after(() => {
    db.close();
  });

  it('creates an expense on first insert', () => {
    const stmt = db.prepare(
      'INSERT INTO expenses (idempotency_key, amount, category, description, date) VALUES (?, ?, ?, ?, ?)'
    );
    const result = stmt.run('key-1', 1250, 'food', 'test', '2026-04-26');
    assert.equal(result.changes, 1);
  });

  it('rejects duplicate idempotency_key with UNIQUE constraint', () => {
    const stmt = db.prepare(
      'INSERT INTO expenses (idempotency_key, amount, category, description, date) VALUES (?, ?, ?, ?, ?)'
    );

    assert.throws(() => {
      stmt.run('key-1', 9999, 'transport', 'duplicate', '2026-04-25');
    }, (err) => {
      return err.code === 'SQLITE_CONSTRAINT_UNIQUE';
    });
  });

  it('only has 1 record after duplicate attempt', () => {
    const count = db.prepare('SELECT COUNT(*) as c FROM expenses WHERE idempotency_key = ?').get('key-1');
    assert.equal(count.c, 1);
  });

  it('original record is unchanged after duplicate attempt', () => {
    const row = db.prepare('SELECT * FROM expenses WHERE idempotency_key = ?').get('key-1');
    assert.equal(row.amount, 1250);
    assert.equal(row.category, 'food');
  });

  it('rejects negative amount via CHECK constraint', () => {
    const stmt = db.prepare(
      'INSERT INTO expenses (idempotency_key, amount, category, description, date) VALUES (?, ?, ?, ?, ?)'
    );
    assert.throws(() => {
      stmt.run('key-negative', -100, 'food', 'bad', '2026-04-26');
    });
  });

  it('SUM returns correct total in cents', () => {
    const stmt = db.prepare(
      'INSERT INTO expenses (idempotency_key, amount, category, description, date) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run('key-2', 4599, 'transport', 'uber', '2026-04-25');

    const total = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses').get();
    assert.equal(total.total, 1250 + 4599);
  });
});
