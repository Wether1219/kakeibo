import { useCallback, useEffect, useState } from 'react';
import * as categoriesApi from '../api/categories';
import * as usersApi from '../api/users';
import * as transactionsApi from '../api/transactions';
import { getCurrentUserId } from '../api/client';
import type { Category } from '../api/categories';
import type { User } from '../api/users';

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
        // 変動費（日々の支出で使用頻度が高い）を先に並べ、初期選択も変動費の先頭費目にする。
        const activeCategories = [...variableCats, ...fixedCats].filter((c) => c.isActive);
        setCategories(activeCategories);
        setCategoryId(activeCategories[0]?.id ?? '');
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

  const variableCategories = categories.filter((c) => c.type === 'variable_expense');
  const fixedCategories = categories.filter((c) => c.type === 'fixed_expense');

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
    variableCategories,
    fixedCategories,
    loading,
    saving,
    error,
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
