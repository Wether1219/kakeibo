import { API_BASE, AuthUser, setSession } from './client';

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? 'ログインに失敗しました');
  }
  const data = await res.json();
  setSession(data.accessToken, data.user);
  return data.user as AuthUser;
}
