import { apiFetch } from './client';

export interface SavingsGoal {
  id: string;
  householdId: string;
  name: string;
  targetAmount: number;
  isActive: boolean;
  createdAt: string;
}

export async function fetchSavingsGoals(): Promise<SavingsGoal[]> {
  const res = await apiFetch('/savings-goals');
  if (!res.ok) throw new Error('貯金目標の取得に失敗しました');
  return res.json();
}

export async function createSavingsGoal(name: string, targetAmount: number): Promise<SavingsGoal> {
  const res = await apiFetch('/savings-goals', {
    method: 'POST',
    body: JSON.stringify({ name, targetAmount }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? '貯金目標の登録に失敗しました');
  }
  return res.json();
}

export async function deactivateSavingsGoal(id: string): Promise<void> {
  const res = await apiFetch(`/savings-goals/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ isActive: false }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? '貯金目標の削除に失敗しました');
  }
}
