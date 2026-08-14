const API_BASE = '/api/v1';

// 認証実装までの暫定措置。フェーズ0でJWTベースのAPIクライアントに置き換える。
const TEMP_HOUSEHOLD_ID = '1';
// useTransactionForm.tsと同じキー（「自分」ユーザーの暫定選択）。
const CURRENT_USER_KEY = 'kakeibo_current_user_id';

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

// 取引入力画面で対象者を切り替えるまでkakeibo_current_user_idが未設定のことがあるため、
// 更新系APIを呼ぶ前にこれを使って世帯の先頭ユーザーを暫定的な「自分」として確定させる。
export async function ensureCurrentUserId(): Promise<string> {
  const existing = localStorage.getItem(CURRENT_USER_KEY);
  if (existing) return existing;
  const users = await fetchUsers();
  const first = users[0]?.id;
  if (!first) throw new Error('ユーザーが見つかりません');
  localStorage.setItem(CURRENT_USER_KEY, first);
  return first;
}
