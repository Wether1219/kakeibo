import { apiFetch } from './client';

export interface WeeklyBudgetWithActual {
  weekNo: number;
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  budgetAmount: number;
  actualAmount: number;
  diff: number;
}

export interface WeeklyBudgetBulkItem {
  year: number;
  month: number;
  weekNo: number;
  categoryId: string;
  budgetAmount: number;
}

export async function fetchWeeklyBudgets(
  year: number,
  month: number
): Promise<WeeklyBudgetWithActual[]> {
  const res = await apiFetch(`/weekly-budgets?year=${year}&month=${month}`);
  if (!res.ok) throw new Error('週次予算の取得に失敗しました');
  return res.json();
}

export async function bulkUpdateWeeklyBudgets(items: WeeklyBudgetBulkItem[]): Promise<unknown> {
  const res = await apiFetch('/weekly-budgets/bulk', {
    method: 'PUT',
    body: JSON.stringify(items),
  });
  if (!res.ok) throw new Error('週次予算の保存に失敗しました');
  return res.json();
}
