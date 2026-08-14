import { apiFetch } from './client';
import type { SplitType } from './transactions';

export interface RecurringTransaction {
  id: string;
  householdId: string;
  categoryId: string;
  splitType: SplitType;
  userId: string | null;
  amount: number;
  memo: string | null;
  dayOfMonth: number;
  isActive: boolean;
  createdAt: string;
}

export interface RecurringTransactionInput {
  categoryId: string;
  splitType: SplitType;
  userId?: string | null;
  amount: number;
  memo?: string | null;
  dayOfMonth: number;
}

export async function fetchRecurringTransactions(): Promise<RecurringTransaction[]> {
  const res = await apiFetch('/recurring-transactions');
  if (!res.ok) throw new Error('定期取引一覧の取得に失敗しました');
  return res.json();
}

export async function createRecurringTransaction(
  data: RecurringTransactionInput
): Promise<RecurringTransaction> {
  const res = await apiFetch('/recurring-transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? '定期取引の登録に失敗しました');
  }
  return res.json();
}

export async function deactivateRecurringTransaction(id: string): Promise<void> {
  const res = await apiFetch(`/recurring-transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ isActive: false }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? '定期取引の無効化に失敗しました');
  }
}
