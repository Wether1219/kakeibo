import { apiFetch } from './client';

export type SettlementDirection = 'A_TO_B' | 'B_TO_A' | 'NONE';

export interface SettlementUserSummary {
  userId: string;
  displayName: string;
}

export interface SettlementHalfSplitBreakdown {
  totalAmount: number;
  fairShare: number;
  contributedByFrom: number;
  subtotal: number;
}

export interface SettlementOtherFullBreakdown {
  subtotal: number;
}

export interface SettlementBreakdown {
  halfSplit: SettlementHalfSplitBreakdown;
  otherFull: SettlementOtherFullBreakdown;
}

export interface MonthlySettlement {
  year: number;
  month: number;
  direction: SettlementDirection;
  fromUser: SettlementUserSummary | null;
  toUser: SettlementUserSummary | null;
  amount: number;
  breakdown: SettlementBreakdown;
  transactionCount: number;
}

export async function fetchMonthlySettlement(year: number, month: number): Promise<MonthlySettlement> {
  const res = await apiFetch(`/settlements?year=${year}&month=${month}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? '精算金額の取得に失敗しました');
  }
  return res.json();
}
