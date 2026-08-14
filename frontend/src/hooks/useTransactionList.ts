import { useCallback, useEffect, useState } from 'react';
import { Category, fetchCategories } from '../api/categories';
import { User, fetchUsers } from '../api/users';
import { Transaction, deleteTransaction, fetchTransactions } from '../api/transactions';

export function useTransactionList(year: number, month: number) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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
      fetchTransactions({ year, month, sort: 'date_desc' }),
      fetchCategories(),
      fetchUsers(),
    ])
      .then(([transactionList, categoryList, userList]) => {
        if (cancelled) return;
        setTransactions(transactionList);
        setCategories(categoryList);
        setUsers(userList);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, month, reloadToken]);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  const removeTransaction = useCallback(
    async (id: string) => {
      await deleteTransaction(id);
      reload();
    },
    [reload]
  );

  return { transactions, categories, users, loading, error, reload, removeTransaction };
}
