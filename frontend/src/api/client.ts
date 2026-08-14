export const API_BASE = '/api/v1';

const TOKEN_KEY = 'kakeibo_access_token';
const CURRENT_USER_KEY = 'kakeibo_current_user_id';

export interface AuthUser {
  id: string;
  householdId: string;
  email: string;
  displayName: string;
  colorCode: string | null;
}

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return getAccessToken() !== null;
}

export function setSession(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(CURRENT_USER_KEY, user.id);
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(CURRENT_USER_KEY);
}

// ログイン中のユーザーID。取引の「対象者」初期値等、認証以外の用途にも使う既存のキーを流用する。
export function getCurrentUserId(): string | null {
  return localStorage.getItem(CURRENT_USER_KEY);
}

// household_id/user_idはAuthorizationヘッダーのJWTからバックエンドが取得するため、
// 呼び出し側はエンドポイントパスとリクエストボディのみを意識すればよい。
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    clearSession();
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }
  return res;
}
