import { AuditAction, Prisma } from '@prisma/client';
import { prisma } from '../prisma';

export interface AuditLogEntry {
  householdId: bigint;
  userId: bigint;
  targetTable: string;
  targetId: bigint;
  action: AuditAction;
  // before/afterはJSONシリアライズ済み（BigInt/Decimalを含まない）状態で渡すこと
  // restoredFromAuditLogIdは、監査ログからの復元（transactionService.restoreTransaction等）で
  // 作成されたレコードにのみ付与し、復元元の削除ログIDを指す（多重復元防止のフロント判定に使用）
  diff: { before?: unknown; after?: unknown; restoredFromAuditLogId?: string };
}

function toDiffJson(diff: AuditLogEntry['diff']): Prisma.InputJsonValue {
  return diff as Prisma.InputJsonValue;
}

export async function recordAuditLog(entry: AuditLogEntry) {
  await prisma.auditLog.create({
    data: {
      householdId: entry.householdId,
      userId: entry.userId,
      targetTable: entry.targetTable,
      targetId: entry.targetId,
      action: entry.action,
      diffJson: toDiffJson(entry.diff),
    },
  });
}

export async function recordAuditLogs(entries: AuditLogEntry[]) {
  if (entries.length === 0) return;
  await prisma.auditLog.createMany({
    data: entries.map((entry) => ({
      householdId: entry.householdId,
      userId: entry.userId,
      targetTable: entry.targetTable,
      targetId: entry.targetId,
      action: entry.action,
      diffJson: toDiffJson(entry.diff),
    })),
  });
}

export interface AuditLogFilter {
  targetTable?: string;
  limit?: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function listAuditLogs(householdId: bigint, filter: AuditLogFilter) {
  const limit = Math.min(Math.max(filter.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  return prisma.auditLog.findMany({
    where: {
      householdId,
      ...(filter.targetTable ? { targetTable: filter.targetTable } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
