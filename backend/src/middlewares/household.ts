import { NextFunction, Request, Response } from 'express';
import { verifyAuthToken } from '../services/authService';

// JWT検証ミドルウェア。Authorizationヘッダー（Bearerトークン）からhouseholdId/userIdを取得する。
export interface HouseholdRequest extends Request {
  householdId?: bigint;
  userId?: bigint;
}

export function authMiddleware(req: HouseholdRequest, res: Response, next: NextFunction) {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  if (!token) {
    res.status(401).json({ error: 'Authorizationヘッダーが必要です' });
    return;
  }
  try {
    const payload = verifyAuthToken(token);
    req.householdId = BigInt(payload.householdId);
    req.userId = BigInt(payload.userId);
    next();
  } catch {
    res.status(401).json({ error: 'トークンが無効です' });
  }
}
