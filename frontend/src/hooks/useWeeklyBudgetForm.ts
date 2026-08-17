import { useCallback, useEffect, useState } from 'react';
import * as weeklyBudgetsApi from '../api/weeklyBudgets';

export interface WeeklyBudgetCategory {
  id: string;
  name: string;
  icon: string | null;
}

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const setBudget = useCallback((weekNo: number, categoryId: string, amount: number) => {
    const key = cellKey(weekNo, categoryId);
    setBudgets((prev) => ({ ...prev, [key]: amount }));
    setSuggestedCells((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const items = weeks.flatMap((weekNo) =>
        categories.map((c) => ({
          year,
          month,
          weekNo,
          categoryId: c.id,
          budgetAmount: budgets[cellKey(weekNo, c.id)] ?? 0,
        }))
      );
      if (items.length > 0) {
        await weeklyBudgetsApi.bulkUpdateWeeklyBudgets(items);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setSaving(false);
    }
  }, [weeks, categories, budgets, year, month, load]);

  return {
    categories,
    weeks,
    budgets,
    actuals,
    suggestedCells,
    loading,
    saving,
    error,
    setBudget,
    save,
  };
}
