import { useCallback, useEffect, useState } from 'react';
import { Category, fetchCategories } from '../api/categories';
import { User, fetchUsers } from '../api/users';
import { Transaction, deleteTransaction, fetchTransactionsPage } from '../api/transactions';

export const TRANSACTION_PAGE_SIZE = 20;

export function useTransactionList(
  year: number,
  month: number,
  categoryId: string,
  keyword: string,
  page: number
) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // 費目・ユーザーは絞り込み条件によらず変わらないため、初回のみ取得する。
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCategories(), fetchUsers()])
      .then(([categoryList, userList]) => {
        if (cancelled) return;
        setCategories(categoryList);
        setUsers(userList);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTransactionsPage({
      year,
      month,
      categoryId: categoryId || undefined,
      keyword: keyword || undefined,
      sort: 'date_desc',
      limit: TRANSACTION_PAGE_SIZE,
      offset: page * TRANSACTION_PAGE_SIZE,
    })
      .then((result) => {
        if (cancelled) return;
        setTransactions(result.items);
        setTotal(result.total);
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
  }, [year, month, categoryId, keyword, page, reloadToken]);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  const removeTransaction = useCallback(
    async (id: string) => {
      await deleteTransaction(id);
      reload();
    },
    [reload]
  );

  return { transactions, total, categories, users, loading, error, reload, removeTransaction };
}
