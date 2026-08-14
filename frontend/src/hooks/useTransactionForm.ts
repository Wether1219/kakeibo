import { useCallback, useEffect, useState } from 'react';
import * as categoriesApi from '../api/categories';
import * as usersApi from '../api/users';
import * as transactionsApi from '../api/transactions';
import { getCurrentUserId } from '../api/client';
import type { Category, CategoryType } from '../api/categories';
import type { User } from '../api/users';

export type ExpenseType = Extract<CategoryType, 'fixed_expense' | 'variable_expense'>;
export type TargetSelection = 'self' | 'other' | 'shared';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useTransactionForm() {
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ログイン中のユーザー = 「自分」。ログイン時にclient.tsが保存する。
  const currentUserId = getCurrentUserId();

  const [expenseType, setExpenseType] = useState<ExpenseType>('variable_expense');
  const [categoryId, setCategoryId] = useState<string>('');
  const [target, setTarget] = useState<TargetSelection>('self');
  const [transactionDate, setTransactionDate] = useState(today());
  const [amount, setAmount] = useState<number | ''>('');
  const [memo, setMemo] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      usersApi.fetchUsers(),
      categoriesApi.fetchCategories('fixed_expense'),
      categoriesApi.fetchCategories('variable_expense'),
    ])
      .then(([userList, fixedCats, variableCats]) => {
        if (cancelled) return;
        setUsers(userList);
        setCategories([...fixedCats, ...variableCats].filter((c) => c.isActive));
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
  }, []);

  const categoriesForType = categories.filter((c) => c.type === expenseType);

  // 選択中の区分に費目がない、または区分切替直後は、その区分の先頭費目を自動選択する
  useEffect(() => {
    if (categoriesForType.length === 0) {
      setCategoryId('');
      return;
    }
    if (!categoriesForType.some((c) => c.id === categoryId)) {
      setCategoryId(categoriesForType[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseType, categories]);

  const otherUser = users.find((u) => u.id !== currentUserId) ?? null;

  const resetEntry = useCallback(() => {
    setTarget('self');
    setTransactionDate(today());
    setAmount('');
    setMemo('');
  }, []);

  const save = useCallback(async () => {
    if (!currentUserId) {
      setError('ユーザーが見つかりません');
      throw new Error('ユーザーが見つかりません');
    }
    if (!categoryId) {
      setError('費目を選択してください');
      throw new Error('費目を選択してください');
    }
    if (amount === '' || amount < 1) {
      setError('金額は1円以上で入力してください');
      throw new Error('金額は1円以上で入力してください');
    }
    setSaving(true);
    setError(null);
    try {
      const splitType = target === 'shared' ? 'shared' : 'self';
      const userId =
        target === 'shared' ? null : target === 'self' ? currentUserId : otherUser?.id ?? currentUserId;
      await transactionsApi.createTransaction({
        transactionDate,
        categoryId,
        splitType,
        userId,
        amount,
        memo: memo.trim() || null,
      });
      resetEntry();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setSaving(false);
    }
  }, [currentUserId, categoryId, target, otherUser, transactionDate, amount, memo, resetEntry]);

  return {
    users,
    currentUserId,
    otherUser,
    categoriesForType,
    loading,
    saving,
    error,
    expenseType,
    setExpenseType,
    categoryId,
    setCategoryId,
    target,
    setTarget,
    transactionDate,
    setTransactionDate,
    amount,
    setAmount,
    memo,
    setMemo,
    save,
  };
}
