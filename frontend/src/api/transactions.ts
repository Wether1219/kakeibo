import { apiFetch } from './client';

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
  const res = await apiFetch(`/transactions${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('取引一覧の取得に失敗しました');
  return res.json();
}

export async function createTransaction(data: TransactionInput): Promise<Transaction> {
  const res = await apiFetch('/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? '取引の登録に失敗しました');
  }
  return res.json();
}

export async function updateTransaction(id: string, data: TransactionInput): Promise<Transaction> {
  const res = await apiFetch(`/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? '取引の更新に失敗しました');
  }
  return res.json();
}

export async function deleteTransaction(id: string): Promise<void> {
  const res = await apiFetch(`/transactions/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? '取引の削除に失敗しました');
  }
}
