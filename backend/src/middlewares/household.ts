import { NextFunction, Request, Response } from 'express';

// 暫定的なhousehold_id/user_id取得ミドルウェア。
// フェーズ0でJWT認証が実装されたら、トークンからhouseholdId/userIdを取得する処理に差し替える。
export interface HouseholdRequest extends Request {
  householdId?: bigint;
  userId?: bigint;
}

export function householdMiddleware(req: HouseholdRequest, res: Response, next: NextFunction) {
  const header = req.header('x-household-id');
  if (!header || !/^\d+$/.test(header)) {
    res.status(401).json({ error: 'x-household-idヘッダーが必要です' });
    return;
  }
  req.householdId = BigInt(header);
  next();
}

// 入力者(created_by)が必要なAPI用。householdMiddlewareの後段で使用する。
export function userMiddleware(req: HouseholdRequest, res: Response, next: NextFunction) {
  const header = req.header('x-user-id');
  if (!header || !/^\d+$/.test(header)) {
    res.status(401).json({ error: 'x-user-idヘッダーが必要です' });
    return;
  }
  req.userId = BigInt(header);
  next();
}
