import { apiFetch } from './client';

export type CategoryType = 'income' | 'pre_saving' | 'fixed_expense' | 'variable_expense';

export interface Category {
  id: string;
  householdId: string;
  type: CategoryType;
  name: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export async function fetchCategories(type?: CategoryType): Promise<Category[]> {
  const query = type ? `?type=${type}` : '';
  const res = await apiFetch(`/categories${query}`);
  if (!res.ok) throw new Error('費目一覧の取得に失敗しました');
  return res.json();
}

export async function createCategory(data: {
  type: CategoryType;
  name: string;
  icon?: string;
}): Promise<Category> {
  const res = await apiFetch('/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('費目の追加に失敗しました');
  return res.json();
}

export async function updateCategory(
  id: string,
  data: { name?: string; icon?: string; sortOrder?: number }
): Promise<Category> {
  const res = await apiFetch(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('費目の更新に失敗しました');
  return res.json();
}

export async function deactivateCategory(id: string): Promise<void> {
  const res = await apiFetch(`/categories/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('費目の無効化に失敗しました');
}
