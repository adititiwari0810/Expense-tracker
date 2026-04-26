/**
 * Business logic layer for expenses.
 *
 * Handles the idempotency check-and-insert flow.
 * Separates business rules from HTTP concerns.
 */

const ExpenseModel = require('../models/expense');
const logger = require('../utils/logger');

const ExpenseService = {
  /**
   * Create an expense idempotently.
   *
   * Flow:
   * 1. Attempt INSERT with the idempotency_key.
   * 2. If UNIQUE constraint violation → look up existing record, return it as duplicate.
   * 3. If success → return the new record.
   *
   * This is safe under concurrency because SQLite serializes writes
   * and the UNIQUE constraint is enforced atomically at the DB level.
   *
   * @returns {{ expense: object, created: boolean }}
   */
  createExpense({ idempotency_key, amount, category, description, date }) {
    try {
      const expense = ExpenseModel.create({
        idempotency_key,
        amount,
        category,
        description,
        date,
      });

      logger.info('Expense created', {
        id: expense.id,
        idempotency_key,
        amount,
        category,
      });

      return { expense, created: true };
    } catch (err) {
      // SQLite UNIQUE constraint violation error code
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        const existing = ExpenseModel.findByIdempotencyKey(idempotency_key);

        if (!existing) {
          // Should not happen, but guard against it
          logger.error('Duplicate detected but record not found', { idempotency_key });
          throw new Error('Inconsistent state: duplicate key but record missing');
        }

        logger.info('Duplicate expense detected, returning existing', {
          id: existing.id,
          idempotency_key,
        });

        return { expense: existing, created: false };
      }

      // Re-throw unexpected errors
      throw err;
    }
  },

  /**
   * List expenses with optional category filter.
   * Returns expenses + computed total of the filtered set.
   */
  listExpenses({ category } = {}) {
    const expenses = ExpenseModel.list({ category });
    const total = ExpenseModel.getTotal({ category });
    const categories = ExpenseModel.getCategories();

    return { expenses, total, count: expenses.length, categories };
  },
};

module.exports = ExpenseService;
