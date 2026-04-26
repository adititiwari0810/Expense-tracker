import { useExpenses } from './hooks/useExpenses';
import ExpenseForm from './components/ExpenseForm';
import ExpenseList from './components/ExpenseList';
import FilterBar from './components/FilterBar';

export default function App() {
  const {
    expenses, total, count, loading, error,
    categoryFilter, setFilter, addExpense,
  } = useExpenses();

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1><span className="logo-icon">💰</span> Expense Tracker</h1>
          <p className="subtitle">Track your spending with precision</p>
        </div>
      </header>
      <main className="app-main">
        <section className="section-form" aria-label="Add expense">
          <ExpenseForm onSubmit={addExpense} />
        </section>
        <section className="section-list" aria-label="Expense list">
          <FilterBar categoryFilter={categoryFilter} onFilterChange={setFilter} total={total} count={count} />
          {error && <div className="list-error"><p>{error}</p></div>}
          <ExpenseList expenses={expenses} loading={loading} />
        </section>
      </main>
      <footer className="app-footer">
        <p>All amounts stored as integer cents — zero floating-point errors.</p>
      </footer>
    </div>
  );
}
