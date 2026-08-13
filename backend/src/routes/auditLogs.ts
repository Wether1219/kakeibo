import { Router } from 'express';
import { AuditAction } from '@prisma/client';
import { HouseholdRequest, householdMiddleware } from '../middlewares/household';
import { listAuditLogs } from '../services/auditLogService';

function serializeAuditLog(log: {
  id: bigint;
  householdId: bigint;
  userId: bigint;
  targetTable: string;
  targetId: bigint;
  action: AuditAction;
  diffJson: unknown;
  createdAt: Date;
}) {
  return {
    id: log.id.toString(),
    householdId: log.householdId.toString(),
    userId: log.userId.toString(),
    targetTable: log.targetTable,
    targetId: log.targetId.toString(),
    action: log.action,
    diff: log.diffJson,
    createdAt: log.createdAt.toISOString(),
  };
}

export const auditLogsRouter = Router();
auditLogsRouter.use(householdMiddleware);

auditLogsRouter.get('/', async (req: HouseholdRequest, res) => {
  const { targetTable, limit } = req.query;
  if (limit !== undefined && !/^\d+$/.test(String(limit))) {
    res.status(400).json({ error: 'limitが不正です' });
    return;
  }
  const logs = await listAuditLogs(req.householdId!, {
    targetTable: targetTable !== undefined ? String(targetTable) : undefined,
    limit: limit !== undefined ? Number(limit) : undefined,
  });
  res.json(logs.map(serializeAuditLog));
});
