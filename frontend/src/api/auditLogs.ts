import { apiFetch } from './client';

export type AuditAction = 'create' | 'update' | 'delete';

export interface AuditLog {
  id: string;
  householdId: string;
  userId: string;
  targetTable: string;
  targetId: string;
  action: AuditAction;
  diff: unknown;
  createdAt: string;
}

export interface AuditLogListParams {
  targetTable?: string;
  limit?: number;
}

export async function fetchAuditLogs(params: AuditLogListParams = {}): Promise<AuditLog[]> {
  const query = new URLSearchParams();
  if (params.targetTable !== undefined) query.set('targetTable', params.targetTable);
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  const qs = query.toString();
  const res = await apiFetch(`/audit-logs${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('変更履歴の取得に失敗しました');
  return res.json();
}
