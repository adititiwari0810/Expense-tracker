import { centsToDisplay } from '../utils/money';

const CATEGORY_EMOJI = {
  food: '🍔',
  transport: '🚗',
  utilities: '💡',
  entertainment: '🎬',
  healthcare: '🏥',
  shopping: '🛍️',
  education: '📚',
  housing: '🏠',
  other: '📦',
};

/**
 * ExpenseList — displays a table of expenses sorted by date (newest first).
 */
export default function ExpenseList({ expenses, loading }) {
  if (loading) {
    return (
      <div className="expense-list-loading">
        <div className="spinner-large"></div>
        <p>Loading expenses...</p>
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="expense-list-empty">
        <p>No expenses found.</p>
        <p className="muted">Add your first expense above, or adjust the filter.</p>
      </div>
    );
  }

  return (
    <div className="expense-list-wrapper">
      <table className="expense-table" id="expense-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Description</th>
            <th className="align-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => (
            <tr key={expense.id} className="expense-row">
              <td className="expense-date">
                {formatDate(expense.date)}
              </td>
              <td className="expense-category">
                <span className="category-badge">
                  {CATEGORY_EMOJI[expense.category] || '📦'}{' '}
                  {capitalize(expense.category)}
                </span>
              </td>
              <td className="expense-description">
                {expense.description || <span className="muted">—</span>}
              </td>
              <td className="expense-amount align-right">
                {centsToDisplay(expense.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-');
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
