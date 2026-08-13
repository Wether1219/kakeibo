const API_BASE = '/api/v1';

// 認証実装までの暫定措置。フェーズ0でJWTベースのAPIクライアントに置き換える。
const TEMP_HOUSEHOLD_ID = '1';

export interface User {
  id: string;
  householdId: string;
  displayName: string;
}

function headers() {
  return {
    'Content-Type': 'application/json',
    'x-household-id': TEMP_HOUSEHOLD_ID,
  };
}

export async function fetchUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE}/users`, { headers: headers() });
  if (!res.ok) throw new Error('ユーザー一覧の取得に失敗しました');
  return res.json();
}
