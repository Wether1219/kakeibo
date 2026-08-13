const API_BASE = '/api/v1';

// 認証実装までの暫定措置。フェーズ0でJWTベースのAPIクライアントに置き換える。
const TEMP_HOUSEHOLD_ID = '1';

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

function headers() {
  return {
    'Content-Type': 'application/json',
    'x-household-id': TEMP_HOUSEHOLD_ID,
  };
}

export async function fetchWeeklyBudgets(
  year: number,
  month: number
): Promise<WeeklyBudgetWithActual[]> {
  const res = await fetch(`${API_BASE}/weekly-budgets?year=${year}&month=${month}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error('週次予算の取得に失敗しました');
  return res.json();
}

export async function bulkUpdateWeeklyBudgets(items: WeeklyBudgetBulkItem[]): Promise<unknown> {
  const res = await fetch(`${API_BASE}/weekly-budgets/bulk`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(items),
  });
  if (!res.ok) throw new Error('週次予算の保存に失敗しました');
  return res.json();
}
