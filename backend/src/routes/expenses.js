/**
 * Express route handlers for /api/expenses.
 *
 * Thin HTTP layer: validates input, calls service, formats response.
 * All business logic lives in expenseService.
 */

const express = require('express');
const { validateExpense, ALLOWED_CATEGORIES } = require('../utils/validation');
const ExpenseService = require('../services/expenseService');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/expenses
 *
 * Create an expense idempotently.
 * - 201: New expense created
 * - 200: Duplicate detected (same idempotency_key), returns existing record
 * - 400: Validation error
 * - 500: Unexpected server error
 */
router.post('/', (req, res) => {
  try {
    const validation = validateExpense(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        fields: validation.errors,
      });
    }

    const { idempotency_key, amount, category, description, date } = req.body;

    const { expense, created } = ExpenseService.createExpense({
      idempotency_key,
      amount,
      category: category.toLowerCase(),
      description: description || '',
      date,
    });

    const status = created ? 201 : 200;
    return res.status(status).json({
      expense,
      duplicate: !created,
    });
  } catch (err) {
    logger.error('POST /api/expenses failed', {
      error: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/expenses
 *
 * List expenses with optional filtering.
 * Query params:
 *   - category: filter by category (lowercase)
 *   - sort: only "date_desc" supported (default)
 *
 * Response includes:
 *   - expenses: array of expense objects
 *   - total: sum of visible expenses (integer cents)
 *   - count: number of visible expenses
 *   - categories: all distinct categories in DB (for filter UI)
 */
router.get('/', (req, res) => {
  try {
    const { category } = req.query;

    // Validate category if provided
    if (category && !ALLOWED_CATEGORIES.includes(category.toLowerCase())) {
      return res.status(400).json({
        error: `Invalid category. Must be one of: ${ALLOWED_CATEGORIES.join(', ')}`,
      });
    }

    const result = ExpenseService.listExpenses({
      category: category ? category.toLowerCase() : undefined,
    });

    return res.json(result);
  } catch (err) {
    logger.error('GET /api/expenses failed', {
      error: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
