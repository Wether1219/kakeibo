const API_BASE = '/api/v1';

// 認証実装までの暫定措置。フェーズ0でJWTベースのAPIクライアントに置き換える。
const TEMP_HOUSEHOLD_ID = '1';

export type SplitType = 'self' | 'shared';

export interface Transaction {
  id: string;
  householdId: string;
  transactionDate: string;
  categoryId: string;
  splitType: SplitType;
  userId: string | null;
  amount: number;
  memo: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionInput {
  transactionDate: string;
  categoryId: string;
  splitType: SplitType;
  userId?: string | null;
  amount: number;
  memo?: string | null;
}

function headers(userId?: string) {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-household-id': TEMP_HOUSEHOLD_ID,
  };
  if (userId) {
    h['x-user-id'] = userId;
  }
  return h;
}

export interface TransactionListParams {
  year?: number;
  month?: number;
  categoryId?: string;
  limit?: number;
  sort?: 'date_desc';
}

export async function fetchTransactions(params: TransactionListParams = {}): Promise<Transaction[]> {
  const query = new URLSearchParams();
  if (params.year !== undefined) query.set('year', String(params.year));
  if (params.month !== undefined) query.set('month', String(params.month));
  if (params.categoryId !== undefined) query.set('categoryId', params.categoryId);
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.sort !== undefined) query.set('sort', params.sort);
  const qs = query.toString();
  const res = await fetch(`${API_BASE}/transactions${qs ? `?${qs}` : ''}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error('取引一覧の取得に失敗しました');
  return res.json();
}

export async function createTransaction(
  userId: string,
  data: TransactionInput
): Promise<Transaction> {
  const res = await fetch(`${API_BASE}/transactions`, {
    method: 'POST',
    headers: headers(userId),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? '取引の登録に失敗しました');
  }
  return res.json();
}

export async function deleteTransaction(id: string, userId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/transactions/${id}`, {
    method: 'DELETE',
    headers: headers(userId),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? '取引の削除に失敗しました');
  }
}
