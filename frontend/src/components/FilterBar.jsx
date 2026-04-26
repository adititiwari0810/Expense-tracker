/**
 * FilterBar — category filter and summary stats.
 */

import { centsToDisplay } from '../utils/money';

const ALL_CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'food', label: '🍔 Food' },
  { value: 'transport', label: '🚗 Transport' },
  { value: 'utilities', label: '💡 Utilities' },
  { value: 'entertainment', label: '🎬 Entertainment' },
  { value: 'healthcare', label: '🏥 Healthcare' },
  { value: 'shopping', label: '🛍️ Shopping' },
  { value: 'education', label: '📚 Education' },
  { value: 'housing', label: '🏠 Housing' },
  { value: 'other', label: '📦 Other' },
];

export default function FilterBar({ categoryFilter, onFilterChange, total, count }) {
  return (
    <div className="filter-bar">
      <div className="filter-controls">
        <label htmlFor="category-filter">Filter by category:</label>
        <select
          id="category-filter"
          value={categoryFilter}
          onChange={(e) => onFilterChange(e.target.value)}
        >
          {ALL_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-stats">
        <div className="stat">
          <span className="stat-label">Total</span>
          <span className="stat-value" id="total-amount">{centsToDisplay(total)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Expenses</span>
          <span className="stat-value" id="expense-count">{count}</span>
        </div>
      </div>
    </div>
  );
}
