import { useCallback, useEffect, useState } from 'react';
import * as categoriesApi from '../api/categories';
import * as usersApi from '../api/users';
import * as incomesApi from '../api/incomes';
import * as preSavingsApi from '../api/preSavings';
import type { Category } from '../api/categories';
import type { User } from '../api/users';

function cellKey(userId: string, categoryId: string) {
  return `${userId}:${categoryId}`;
}

export function useIncomeAndPreSavingForm(year: number, month: number) {
  const [users, setUsers] = useState<User[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [preSavingCategories, setPreSavingCategories] = useState<Category[]>([]);
  const [incomeValues, setIncomeValues] = useState<Record<string, number>>({});
  const [preSavingBudgets, setPreSavingBudgets] = useState<Record<string, number>>({});
  const [preSavingActuals, setPreSavingActuals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      usersApi.fetchUsers(),
      categoriesApi.fetchCategories('income'),
      categoriesApi.fetchCategories('pre_saving'),
      incomesApi.fetchIncomes(year, month),
      preSavingsApi.fetchPreSavings(year, month),
    ])
      .then(([userList, incomeCats, preSavingCats, incomes, preSavings]) => {
        if (cancelled) return;
        setUsers(userList);
        setIncomeCategories(incomeCats.filter((c) => c.isActive));
        setPreSavingCategories(preSavingCats.filter((c) => c.isActive));
        const nextIncomeValues: Record<string, number> = {};
        incomes.forEach((i) => {
          nextIncomeValues[cellKey(i.userId, i.categoryId)] = i.amount;
        });
        setIncomeValues(nextIncomeValues);
        const nextBudgets: Record<string, number> = {};
        const nextActuals: Record<string, number> = {};
        preSavings.forEach((p) => {
          const key = cellKey(p.userId, p.categoryId);
          nextBudgets[key] = p.budgetAmount;
          nextActuals[key] = p.actualAmount;
        });
        setPreSavingBudgets(nextBudgets);
        setPreSavingActuals(nextActuals);
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
  }, [year, month]);

  const setIncomeAmount = useCallback((userId: string, categoryId: string, amount: number) => {
    setIncomeValues((prev) => ({ ...prev, [cellKey(userId, categoryId)]: amount }));
  }, []);

  const setPreSavingBudget = useCallback((userId: string, categoryId: string, amount: number) => {
    setPreSavingBudgets((prev) => ({ ...prev, [cellKey(userId, categoryId)]: amount }));
  }, []);

  const setPreSavingActual = useCallback((userId: string, categoryId: string, amount: number) => {
    setPreSavingActuals((prev) => ({ ...prev, [cellKey(userId, categoryId)]: amount }));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const incomeItems = users.flatMap((u) =>
        incomeCategories.map((c) => ({
          year,
          month,
          userId: u.id,
          categoryId: c.id,
          amount: incomeValues[cellKey(u.id, c.id)] ?? 0,
        }))
      );
      const preSavingItems = users.flatMap((u) =>
        preSavingCategories.map((c) => ({
          year,
          month,
          userId: u.id,
          categoryId: c.id,
          budgetAmount: preSavingBudgets[cellKey(u.id, c.id)] ?? 0,
          actualAmount: preSavingActuals[cellKey(u.id, c.id)] ?? 0,
        }))
      );
      if (incomeItems.length > 0) {
        await incomesApi.bulkUpdateIncomes(incomeItems);
      }
      if (preSavingItems.length > 0) {
        await preSavingsApi.bulkUpdatePreSavings(preSavingItems);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setSaving(false);
    }
  }, [users, incomeCategories, preSavingCategories, incomeValues, preSavingBudgets, preSavingActuals, year, month]);

  return {
    users,
    incomeCategories,
    preSavingCategories,
    incomeValues,
    preSavingBudgets,
    preSavingActuals,
    loading,
    saving,
    error,
    setIncomeAmount,
    setPreSavingBudget,
    setPreSavingActual,
    save,
    cellKey,
  };
}
