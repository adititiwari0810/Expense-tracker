import { useState, useRef, useEffect } from 'react';
import { dollarsToCents } from '../utils/money';

const CATEGORIES = [
  { value: 'food', label: 'Food' },
  { value: 'transport', label: 'Transport' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'education', label: 'Education' },
  { value: 'housing', label: 'Housing' },
  { value: 'other', label: 'Other' },
];

function generateKey() {
  return crypto.randomUUID();
}

/**
 * ExpenseForm component.
 *
 * Generates a new idempotency_key on mount and after each successful submission.
 * The key is tied to the form state, so retries of the same submission use the same key.
 * A new key is generated only after a confirmed success.
 *
 * Double-click protection: button is disabled during submission.
 */
export default function ExpenseForm({ onSubmit }) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // Idempotency key — generated once, refreshed only after successful submit
  const idempotencyKeyRef = useRef(generateKey());

  // Focus the amount input on mount
  const amountRef = useRef(null);
  useEffect(() => {
    amountRef.current?.focus();
  }, []);

  function validateLocally() {
    const errors = {};

    if (!amount || amount.trim() === '') {
      errors.amount = 'Amount is required';
    } else {
      const cents = dollarsToCents(amount);
      if (cents === null) {
        errors.amount = 'Enter a valid amount (e.g. 12.50)';
      } else if (cents <= 0) {
        errors.amount = 'Amount must be greater than zero';
      }
    }

    if (!category) {
      errors.category = 'Select a category';
    }

    if (!date) {
      errors.date = 'Date is required';
    }

    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // Client-side validation
    const validationErrors = validateLocally();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError(null);
      setSuccess(null);
      return;
    }

    setFieldErrors({});
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const cents = dollarsToCents(amount);
      const result = await onSubmit({
        idempotency_key: idempotencyKeyRef.current,
        amount: cents,
        category,
        description: description.trim(),
        date,
      });

      if (result.duplicate) {
        setSuccess('Expense already recorded (duplicate detected).');
      } else {
        setSuccess('Expense added successfully!');
      }

      // Reset form and generate new idempotency key
      setAmount('');
      setCategory('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
      idempotencyKeyRef.current = generateKey();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);

      // Refocus amount input
      amountRef.current?.focus();
    } catch (err) {
      // On failure, keep the same idempotency key so retries are safe
      if (err.data?.fields) {
        setFieldErrors(err.data.fields);
      }
      setError(err.message || 'Failed to add expense. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="expense-form" onSubmit={handleSubmit} noValidate>
      <h2>Add Expense</h2>

      {error && <div className="form-message form-error">{error}</div>}
      {success && <div className="form-message form-success">{success}</div>}

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="expense-amount">Amount ($)</label>
          <input
            ref={amountRef}
            id="expense-amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={fieldErrors.amount ? 'input-error' : ''}
            disabled={submitting}
            autoComplete="off"
          />
          {fieldErrors.amount && <span className="field-error">{fieldErrors.amount}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="expense-category">Category</label>
          <select
            id="expense-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={fieldErrors.category ? 'input-error' : ''}
            disabled={submitting}
          >
            <option value="">Select...</option>
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
          {fieldErrors.category && <span className="field-error">{fieldErrors.category}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="expense-date">Date</label>
          <input
            id="expense-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={fieldErrors.date ? 'input-error' : ''}
            disabled={submitting}
          />
          {fieldErrors.date && <span className="field-error">{fieldErrors.date}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="expense-description">Description</label>
          <input
            id="expense-description"
            type="text"
            placeholder="What was this for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
            maxLength={500}
            autoComplete="off"
          />
        </div>
      </div>

      <button
        id="submit-expense"
        type="submit"
        className="btn-primary"
        disabled={submitting}
      >
        {submitting ? (
          <>
            <span className="spinner"></span>
            Adding...
          </>
        ) : (
          'Add Expense'
        )}
      </button>
    </form>
  );
}
