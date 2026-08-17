import { useCallback, useEffect, useRef, useState } from 'react';
import * as weeklyBudgetsApi from '../api/weeklyBudgets';

export interface WeeklyBudgetCategory {
  id: string;
  name: string;
  icon: string | null;
}

const DEBOUNCE_MS = 500;

function cellKey(weekNo: number, categoryId: string) {
  return `${weekNo}:${categoryId}`;
}

export function useWeeklyBudgetForm(year: number, month: number) {
  const [categories, setCategories] = useState<WeeklyBudgetCategory[]>([]);
  const [weeks, setWeeks] = useState<number[]>([]);
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [actuals, setActuals] = useState<Record<string, number>>({});
  const [suggestedCells, setSuggestedCells] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return weeklyBudgetsApi
      .fetchWeeklyBudgets(year, month)
      .then((rows) => {
        const nextCategories: WeeklyBudgetCategory[] = [];
        const seenCategoryIds = new Set<string>();
        const weekSet = new Set<number>();
        const nextBudgets: Record<string, number> = {};
        const nextActuals: Record<string, number> = {};
        const nextSuggestedCells = new Set<string>();
        rows.forEach((row) => {
          if (!seenCategoryIds.has(row.categoryId)) {
            seenCategoryIds.add(row.categoryId);
            nextCategories.push({
              id: row.categoryId,
              name: row.categoryName,
              icon: row.categoryIcon,
            });
          }
          weekSet.add(row.weekNo);
          const key = cellKey(row.weekNo, row.categoryId);
          // 未入力（DBに未保存）のセルは、前月までの実績から自動算出した金額を初期値として表示する
          if (row.hasBudget) {
            nextBudgets[key] = row.budgetAmount;
          } else {
            nextBudgets[key] = row.suggestedAmount;
            nextSuggestedCells.add(key);
          }
          nextActuals[key] = row.actualAmount;
        });
        setCategories(nextCategories);
        setWeeks(Array.from(weekSet).sort((a, b) => a - b));
        setBudgets(nextBudgets);
        setActuals(nextActuals);
        setSuggestedCells(nextSuggestedCells);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return () => {
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current.clear();
    };
  }, [year, month]);

  const setBudget = useCallback(
    (weekNo: number, categoryId: string, amount: number) => {
      const key = cellKey(weekNo, categoryId);
      setBudgets((prev) => ({ ...prev, [key]: amount }));
      setSuggestedCells((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });

      const existingTimer = timers.current.get(key);
      if (existingTimer) clearTimeout(existingTimer);
      setSavingCells((prev) => new Set(prev).add(key));

      const timer = setTimeout(async () => {
        timers.current.delete(key);
        try {
          await weeklyBudgetsApi.bulkUpdateWeeklyBudgets([
            { year, month, weekNo, categoryId, budgetAmount: amount },
          ]);
          // 他セルの実績・自動算出額はこのセルの保存によって変わらないため、全体reloadは行わない
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setSavingCells((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }
      }, DEBOUNCE_MS);
      timers.current.set(key, timer);
    },
    [year, month]
  );

  const isSaving = useCallback(
    (weekNo: number, categoryId: string) => savingCells.has(cellKey(weekNo, categoryId)),
    [savingCells]
  );

  return {
    categories,
    weeks,
    budgets,
    actuals,
    suggestedCells,
    loading,
    error,
    setBudget,
    isSaving,
  };
}
