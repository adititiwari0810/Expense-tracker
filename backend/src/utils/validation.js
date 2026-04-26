/**
 * Input validation for expense data.
 * Returns { valid: true } or { valid: false, errors: { field: message } }
 */

const ALLOWED_CATEGORIES = [
  'food',
  'transport',
  'utilities',
  'entertainment',
  'healthcare',
  'shopping',
  'education',
  'housing',
  'other',
];

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validateExpense(body) {
  const errors = {};

  // idempotency_key: required, non-empty string
  if (!body.idempotency_key || typeof body.idempotency_key !== 'string' || body.idempotency_key.trim() === '') {
    errors.idempotency_key = 'idempotency_key is required and must be a non-empty string';
  }

  // amount: required, integer, > 0 (cents)
  if (body.amount === undefined || body.amount === null) {
    errors.amount = 'amount is required';
  } else if (!Number.isInteger(body.amount)) {
    errors.amount = 'amount must be an integer (cents)';
  } else if (body.amount <= 0) {
    errors.amount = 'amount must be greater than 0';
  } else if (body.amount > 999_999_999) {
    // ~$10M max per expense — prevents overflow
    errors.amount = 'amount exceeds maximum allowed value';
  }

  // category: required, must be from allowed list
  if (!body.category || typeof body.category !== 'string') {
    errors.category = 'category is required';
  } else if (!ALLOWED_CATEGORIES.includes(body.category.toLowerCase())) {
    errors.category = `category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`;
  }

  // description: optional, but if present must be a string, max 500 chars
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') {
      errors.description = 'description must be a string';
    } else if (body.description.length > 500) {
      errors.description = 'description must be 500 characters or fewer';
    }
  }

  // date: required, ISO 8601 date format, must be a real date
  if (!body.date || typeof body.date !== 'string') {
    errors.date = 'date is required (YYYY-MM-DD)';
  } else if (!ISO_DATE_REGEX.test(body.date)) {
    errors.date = 'date must be in YYYY-MM-DD format';
  } else {
    const parsed = new Date(body.date + 'T00:00:00Z');
    if (isNaN(parsed.getTime())) {
      errors.date = 'date is not a valid calendar date';
    }
  }

  const valid = Object.keys(errors).length === 0;
  return { valid, errors: valid ? undefined : errors };
}

module.exports = { validateExpense, ALLOWED_CATEGORIES };
