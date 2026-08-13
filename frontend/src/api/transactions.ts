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

function headers(userId: string) {
  return {
    'Content-Type': 'application/json',
    'x-household-id': TEMP_HOUSEHOLD_ID,
    'x-user-id': userId,
  };
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
