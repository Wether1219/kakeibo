import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET環境変数が設定されていません');
}

const JWT_EXPIRES_IN = '30d';

export interface AuthTokenPayload {
  householdId: string;
  userId: string;
}

export class InvalidCredentialsError extends Error {}

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_SECRET as string) as AuthTokenPayload;
}

export async function loginWithPassword(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new InvalidCredentialsError('メールアドレスまたはパスワードが正しくありません');
  }
  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new InvalidCredentialsError('メールアドレスまたはパスワードが正しくありません');
  }
  const token = signAuthToken({
    householdId: user.householdId.toString(),
    userId: user.id.toString(),
  });
  return { token, user };
}
