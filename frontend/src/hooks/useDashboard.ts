import { useCallback, useEffect, useState } from 'react';
import { Category, fetchCategories } from '../api/categories';
import { MonthlySummary, fetchMonthlySummary } from '../api/summary';
import { Transaction, deleteTransaction, fetchTransactions } from '../api/transactions';
import { User, fetchUsers } from '../api/users';
import { WeeklyBudgetWithActual, fetchWeeklyBudgets } from '../api/weeklyBudgets';

export interface DashboardData {
  summary: MonthlySummary | null;
  weeklyBudgets: WeeklyBudgetWithActual[];
  recentTransactions: Transaction[];
  categories: Category[];
  users: User[];
  loading: boolean;
  error: string | null;
  removeTransaction: (id: string, userId: string) => Promise<void>;
}

export function useDashboard(year: number, month: number): DashboardData {
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [weeklyBudgets, setWeeklyBudgets] = useState<WeeklyBudgetWithActual[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchMonthlySummary(year, month),
      fetchWeeklyBudgets(year, month),
      fetchTransactions({ year, month, limit: 10, sort: 'date_desc' }),
      fetchCategories(),
      fetchUsers(),
    ])
      .then(([summaryRes, weeklyBudgetsRes, transactionsRes, categoriesRes, usersRes]) => {
        if (cancelled) return;
        setSummary(summaryRes);
        setWeeklyBudgets(weeklyBudgetsRes);
        setRecentTransactions(transactionsRes);
        setCategories(categoriesRes);
        setUsers(usersRes);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, month, reloadToken]);

  const removeTransaction = useCallback(async (id: string, userId: string) => {
    await deleteTransaction(id, userId);
    setReloadToken((t) => t + 1);
  }, []);

  return { summary, weeklyBudgets, recentTransactions, categories, users, loading, error, removeTransaction };
}
