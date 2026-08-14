import { apiFetch } from './client';

export interface Income {
  id: string;
  householdId: string;
  year: number;
  month: number;
  userId: string;
  categoryId: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IncomeBulkItem {
  year: number;
  month: number;
  userId: string;
  categoryId: string;
  amount: number;
}

export async function fetchIncomes(year: number, month: number): Promise<Income[]> {
  const res = await apiFetch(`/incomes?year=${year}&month=${month}`);
  if (!res.ok) throw new Error('収入の取得に失敗しました');
  return res.json();
}

export async function bulkUpdateIncomes(items: IncomeBulkItem[]): Promise<Income[]> {
  const res = await apiFetch('/incomes/bulk', {
    method: 'PUT',
    body: JSON.stringify(items),
  });
  if (!res.ok) throw new Error('収入の保存に失敗しました');
  return res.json();
}
