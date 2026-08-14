import { signAuthToken } from '../../src/services/authService';

// テスト用: 実際のログイン(bcrypt照合)を経由せず、指定したhouseholdId/userIdで有効なJWTを発行する。
// ログインAPI自体の検証はtests/auth.test.tsで別途行う。
export function authHeader(householdId: bigint, userId: bigint): string {
  const token = signAuthToken({
    householdId: householdId.toString(),
    userId: userId.toString(),
  });
  return `Bearer ${token}`;
}
