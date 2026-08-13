const API_BASE = '/api/v1';

// 認証実装までの暫定措置。フェーズ0でJWTベースのAPIクライアントに置き換える。
const TEMP_HOUSEHOLD_ID = '1';
// useTransactionForm.tsと同じキー（「自分」ユーザーの暫定選択）。
const CURRENT_USER_KEY = 'kakeibo_current_user_id';

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

function headers() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-household-id': TEMP_HOUSEHOLD_ID,
  };
  const userId = localStorage.getItem(CURRENT_USER_KEY);
  if (userId) {
    headers['x-user-id'] = userId;
  }
  return headers;
}

export async function fetchPreSavings(year: number, month: number): Promise<PreSaving[]> {
  const res = await fetch(`${API_BASE}/pre-savings?year=${year}&month=${month}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error('先取り貯金の取得に失敗しました');
  return res.json();
}

export async function bulkUpdatePreSavings(items: PreSavingBulkItem[]): Promise<PreSaving[]> {
  const res = await fetch(`${API_BASE}/pre-savings/bulk`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(items),
  });
  if (!res.ok) throw new Error('先取り貯金の保存に失敗しました');
  return res.json();
}
