import { apiFetch } from './client';

export interface User {
  id: string;
  householdId: string;
  displayName: string;
}

export async function fetchUsers(): Promise<User[]> {
  const res = await apiFetch('/users');
  if (!res.ok) throw new Error('ユーザー一覧の取得に失敗しました');
  return res.json();
}
