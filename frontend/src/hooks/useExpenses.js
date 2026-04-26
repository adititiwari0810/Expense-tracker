import { useState, useEffect, useCallback } from 'react';
import { fetchExpenses, createExpense, ApiError } from '../utils/api';

/**
 * Custom hook for expense state management.
 * Handles loading, error, and data states for the expense list.
 */
export function useExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('');

  const loadExpenses = useCallback(async (category) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await fetchExpenses({ category: category || undefined });
      setExpenses(data.expenses);
      setTotal(data.total);
      setCount(data.count);
      setCategories(data.categories);
    } catch (err) {
      console.error('Failed to load expenses:', err);
      setError(err instanceof ApiError ? err.message : 'Failed to load expenses. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load expenses on mount and when filter changes
  useEffect(() => {
    loadExpenses(categoryFilter);
  }, [categoryFilter, loadExpenses]);

  const addExpense = useCallback(async (expenseData) => {
    const { data, status } = await createExpense(expenseData);

    // Reload the list to get fresh data
    await loadExpenses(categoryFilter);

    return { expense: data.expense, duplicate: data.duplicate, status };
  }, [categoryFilter, loadExpenses]);

  const setFilter = useCallback((category) => {
    setCategoryFilter(category);
  }, []);

  return {
    expenses,
    total,
    count,
    categories,
    loading,
    error,
    categoryFilter,
    setFilter,
    addExpense,
    refresh: () => loadExpenses(categoryFilter),
  };
}
