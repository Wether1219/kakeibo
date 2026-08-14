import { ensureCurrentUserId } from './users';

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
// useTransactionForm.tsと同じキー（「自分」ユーザーの暫定選択）。
const CURRENT_USER_KEY = 'kakeibo_current_user_id';

function headers(userId?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-household-id': TEMP_HOUSEHOLD_ID,
  };
  const resolvedUserId = userId ?? localStorage.getItem(CURRENT_USER_KEY);
  if (resolvedUserId) {
    headers['x-user-id'] = resolvedUserId;
  }
  return headers;
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
  const userId = await ensureCurrentUserId();
  const res = await fetch(`${API_BASE}/categories`, {
    method: 'POST',
    headers: headers(userId),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('費目の追加に失敗しました');
  return res.json();
}

export async function updateCategory(
  id: string,
  data: { name?: string; icon?: string; sortOrder?: number }
): Promise<Category> {
  const userId = await ensureCurrentUserId();
  const res = await fetch(`${API_BASE}/categories/${id}`, {
    method: 'PUT',
    headers: headers(userId),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('費目の更新に失敗しました');
  return res.json();
}

export async function deactivateCategory(id: string): Promise<void> {
  const userId = await ensureCurrentUserId();
  const res = await fetch(`${API_BASE}/categories/${id}`, {
    method: 'DELETE',
    headers: headers(userId),
  });
  if (!res.ok) throw new Error('費目の無効化に失敗しました');
}
