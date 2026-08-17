import { useCallback, useEffect, useRef, useState } from 'react';
import * as categoriesApi from '../api/categories';
import * as usersApi from '../api/users';
import * as incomesApi from '../api/incomes';
import * as preSavingsApi from '../api/preSavings';
import type { Category } from '../api/categories';
import type { User } from '../api/users';

const DEBOUNCE_MS = 500;

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
  const [error, setError] = useState<string | null>(null);
  const [savingIncomeCells, setSavingIncomeCells] = useState<Set<string>>(new Set());
  const [savingPreSavingCells, setSavingPreSavingCells] = useState<Set<string>>(new Set());

  // pre_savingsはbudgetAmount/actualAmountを同一行・同一APIで一括更新するため、
  // デバウンス発火時にどちらか片方が古い値のまま送信されないよう、常に最新値をrefで保持する
  const preSavingBudgetsRef = useRef<Record<string, number>>({});
  const preSavingActualsRef = useRef<Record<string, number>>({});
  const incomeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const preSavingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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
        preSavingBudgetsRef.current = nextBudgets;
        preSavingActualsRef.current = nextActuals;
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

  useEffect(() => {
    return () => {
      incomeTimers.current.forEach((timer) => clearTimeout(timer));
      incomeTimers.current.clear();
      preSavingTimers.current.forEach((timer) => clearTimeout(timer));
      preSavingTimers.current.clear();
    };
  }, [year, month]);

  const setIncomeAmount = useCallback(
    (userId: string, categoryId: string, amount: number) => {
      const key = cellKey(userId, categoryId);
      setIncomeValues((prev) => ({ ...prev, [key]: amount }));

      const existingTimer = incomeTimers.current.get(key);
      if (existingTimer) clearTimeout(existingTimer);
      setSavingIncomeCells((prev) => new Set(prev).add(key));

      const timer = setTimeout(async () => {
        incomeTimers.current.delete(key);
        try {
          await incomesApi.bulkUpdateIncomes([{ year, month, userId, categoryId, amount }]);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setSavingIncomeCells((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }
      }, DEBOUNCE_MS);
      incomeTimers.current.set(key, timer);
    },
    [year, month]
  );

  const schedulePreSavingSave = useCallback(
    (userId: string, categoryId: string) => {
      const key = cellKey(userId, categoryId);
      const existingTimer = preSavingTimers.current.get(key);
      if (existingTimer) clearTimeout(existingTimer);
      setSavingPreSavingCells((prev) => new Set(prev).add(key));

      const timer = setTimeout(async () => {
        preSavingTimers.current.delete(key);
        try {
          await preSavingsApi.bulkUpdatePreSavings([
            {
              year,
              month,
              userId,
              categoryId,
              budgetAmount: preSavingBudgetsRef.current[key] ?? 0,
              actualAmount: preSavingActualsRef.current[key] ?? 0,
            },
          ]);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setSavingPreSavingCells((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }
      }, DEBOUNCE_MS);
      preSavingTimers.current.set(key, timer);
    },
    [year, month]
  );

  const setPreSavingBudget = useCallback(
    (userId: string, categoryId: string, amount: number) => {
      const key = cellKey(userId, categoryId);
      preSavingBudgetsRef.current = { ...preSavingBudgetsRef.current, [key]: amount };
      setPreSavingBudgets((prev) => ({ ...prev, [key]: amount }));
      schedulePreSavingSave(userId, categoryId);
    },
    [schedulePreSavingSave]
  );

  const setPreSavingActual = useCallback(
    (userId: string, categoryId: string, amount: number) => {
      const key = cellKey(userId, categoryId);
      preSavingActualsRef.current = { ...preSavingActualsRef.current, [key]: amount };
      setPreSavingActuals((prev) => ({ ...prev, [key]: amount }));
      schedulePreSavingSave(userId, categoryId);
    },
    [schedulePreSavingSave]
  );

  const isIncomeSaving = useCallback(
    (userId: string, categoryId: string) => savingIncomeCells.has(cellKey(userId, categoryId)),
    [savingIncomeCells]
  );

  const isPreSavingSaving = useCallback(
    (userId: string, categoryId: string) => savingPreSavingCells.has(cellKey(userId, categoryId)),
    [savingPreSavingCells]
  );

  return {
    users,
    incomeCategories,
    preSavingCategories,
    incomeValues,
    preSavingBudgets,
    preSavingActuals,
    loading,
    error,
    setIncomeAmount,
    setPreSavingBudget,
    setPreSavingActual,
    isIncomeSaving,
    isPreSavingSaving,
    cellKey,
  };
}
