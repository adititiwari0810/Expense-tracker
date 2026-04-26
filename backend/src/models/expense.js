/**
 * Data access layer for expenses.
 *
 * All DB operations go through this module. No raw SQL elsewhere.
 * Uses prepared statements for safety and performance.
 */

const { getDb } = require('../db/database');

const ExpenseModel = {
  /**
   * Insert a new expense. Returns the inserted row.
   * Throws if idempotency_key already exists (UNIQUE constraint).
   */
  create({ idempotency_key, amount, category, description, date }) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO expenses (idempotency_key, amount, category, description, date)
      VALUES (@idempotency_key, @amount, @category, @description, @date)
    `);

    const result = stmt.run({
      idempotency_key,
      amount,
      category: category.toLowerCase(),
      description: description || '',
      date,
    });

    return this.findById(result.lastInsertRowid);
  },

  /**
   * Find an expense by its idempotency_key.
   * Used to return existing record on duplicate POST.
   */
  findByIdempotencyKey(key) {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM expenses WHERE idempotency_key = ?');
    return stmt.get(key) || null;
  },

  /**
   * Find an expense by ID.
   */
  findById(id) {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM expenses WHERE id = ?');
    return stmt.get(id) || null;
  },

  /**
   * List expenses with optional category filter.
   * Always sorted by date descending (newest first), then by created_at descending.
   */
  list({ category } = {}) {
    const db = getDb();
    let sql = 'SELECT * FROM expenses';
    const params = {};

    if (category) {
      sql += ' WHERE category = @category';
      params.category = category.toLowerCase();
    }

    sql += ' ORDER BY date DESC, created_at DESC';

    const stmt = db.prepare(sql);
    return stmt.all(params);
  },

  /**
   * Get the sum of amounts for expenses matching the filter.
   * Returns an integer (cents). Uses SQL SUM for accuracy.
   */
  getTotal({ category } = {}) {
    const db = getDb();
    let sql = 'SELECT COALESCE(SUM(amount), 0) as total FROM expenses';
    const params = {};

    if (category) {
      sql += ' WHERE category = @category';
      params.category = category.toLowerCase();
    }

    const stmt = db.prepare(sql);
    const row = stmt.get(params);
    return row.total;
  },

  /**
   * Get distinct categories that have expenses.
   */
  getCategories() {
    const db = getDb();
    const stmt = db.prepare('SELECT DISTINCT category FROM expenses ORDER BY category');
    return stmt.all().map((row) => row.category);
  },
};

module.exports = ExpenseModel;
