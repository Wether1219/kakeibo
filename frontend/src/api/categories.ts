const API_BASE = '/api/v1';

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

// 認証実装までの暫定措置。フェーズ0でJWTベースのAPIクライアントに置き換える。
const TEMP_HOUSEHOLD_ID = '1';

function headers() {
  return {
    'Content-Type': 'application/json',
    'x-household-id': TEMP_HOUSEHOLD_ID,
  };
}

export async function fetchCategories(type?: CategoryType): Promise<Category[]> {
  const query = type ? `?type=${type}` : '';
  const res = await fetch(`${API_BASE}/categories${query}`, { headers: headers() });
  if (!res.ok) throw new Error('費目一覧の取得に失敗しました');
  return res.json();
}

export async function createCategory(data: {
  type: CategoryType;
  name: string;
  icon?: string;
}): Promise<Category> {
  const res = await fetch(`${API_BASE}/categories`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('費目の追加に失敗しました');
  return res.json();
}

export async function updateCategory(
  id: string,
  data: { name?: string; icon?: string; sortOrder?: number }
): Promise<Category> {
  const res = await fetch(`${API_BASE}/categories/${id}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('費目の更新に失敗しました');
  return res.json();
}

export async function deactivateCategory(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/categories/${id}`, {
    method: 'DELETE',
    headers: headers(),
  });
  if (!res.ok) throw new Error('費目の無効化に失敗しました');
}
