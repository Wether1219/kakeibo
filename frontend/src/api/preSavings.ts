import { apiFetch } from './client';

export interface PreSaving {
  id: string;
  householdId: string;
  year: number;
  month: number;
  userId: string;
  categoryId: string;
  budgetAmount: number;
  actualAmount: number;
  createdAt: string;
}

export interface PreSavingBulkItem {
  year: number;
  month: number;
  userId: string;
  categoryId: string;
  budgetAmount: number;
  actualAmount: number;
}

export async function fetchPreSavings(year: number, month: number): Promise<PreSaving[]> {
  const res = await apiFetch(`/pre-savings?year=${year}&month=${month}`);
  if (!res.ok) throw new Error('先取り貯金の取得に失敗しました');
  return res.json();
}

export async function bulkUpdatePreSavings(items: PreSavingBulkItem[]): Promise<PreSaving[]> {
  const res = await apiFetch('/pre-savings/bulk', {
    method: 'PUT',
    body: JSON.stringify(items),
  });
  if (!res.ok) throw new Error('先取り貯金の保存に失敗しました');
  return res.json();
}
