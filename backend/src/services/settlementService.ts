// docs/08_割り勘計算 仕様書.md 3章「精算ロジック（実装仕様）」のアプリロジック化。
// 対象は settlement_payer_user_id が設定された取引のみで、5.1の按分ロジック（split_type）とは無関係の
// 読み取り専用集計として実装する（3.3節）。

import { prisma } from '../prisma';

export type SettlementBurden = 'half' | 'other_full';

export interface SettlementMarkerTransaction {
  settlementPayerUserId: bigint | null;
  settlementBurden: SettlementBurden | null;
  settlementPartialAmount: number | null;
  amount: number;
}

export type SettlementDirection = 'A_TO_B' | 'B_TO_A' | 'NONE';

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

export interface SettlementResult {
  direction: SettlementDirection;
  amount: number;
  breakdown: SettlementBreakdown;
  transactionCount: number;
}

/**
 * 3.1節の疑似コードに厳密に従う。
 * 3.2節: 取引ごとには丸めず、最終合計(netA)に対してのみMath.round()を適用する。
 * 内訳（breakdown）はnetAと同じループ内の値（share/fronted/partial）から導出し、
 * 最終的な方向（=fromUser側）から見た数値になるよう符号を合わせる。
 */
export function calculateSettlement(
  transactions: SettlementMarkerTransaction[],
  memberIds: readonly [bigint, bigint] // [A, B]（A = household内user_id昇順の先頭）
): SettlementResult {
  let netAHalf = 0;
  let netAOtherFull = 0;
  let halfTotalAmount = 0;
  let transactionCount = 0;

  for (const t of transactions) {
    if (t.settlementPayerUserId === null || t.settlementBurden === null) {
      continue;
    }
    const payerIndex = memberIds.indexOf(t.settlementPayerUserId);
    if (payerIndex !== 0 && payerIndex !== 1) {
      continue;
    }
    transactionCount += 1;

    const amount = t.amount;
    const partial = t.settlementPartialAmount ?? 0;
    const fronted = amount - partial;

    if (t.settlementBurden === 'half') {
      const share = amount / 2;
      halfTotalAmount += amount;
      if (payerIndex === 0) {
        netAHalf += share - fronted;
      } else {
        netAHalf += share - partial;
      }
    } else {
      if (payerIndex === 0) {
        netAOtherFull -= fronted;
      } else {
        netAOtherFull += fronted;
      }
    }
  }

  const netA = netAHalf + netAOtherFull;
  const roundedNet = Math.round(netA);
  const direction: SettlementDirection = roundedNet > 0 ? 'A_TO_B' : roundedNet < 0 ? 'B_TO_A' : 'NONE';
  const fromIsA = direction !== 'B_TO_A';

  const halfSubtotal = fromIsA ? netAHalf : -netAHalf;
  const otherFullSubtotal = fromIsA ? netAOtherFull : -netAOtherFull;
  const fairShare = halfTotalAmount / 2;

  return {
    direction,
    amount: Math.abs(roundedNet),
    breakdown: {
      halfSplit: {
        totalAmount: halfTotalAmount,
        fairShare,
        contributedByFrom: fairShare - halfSubtotal,
        subtotal: halfSubtotal,
      },
      otherFull: {
        subtotal: otherFullSubtotal,
      },
    },
    transactionCount,
  };
}

export class SettlementValidationError extends Error {}

export interface SettlementUserSummary {
  userId: string;
  displayName: string;
}

export interface MonthlySettlementResult {
  year: number;
  month: number;
  direction: SettlementDirection;
  fromUser: SettlementUserSummary | null;
  toUser: SettlementUserSummary | null;
  amount: number;
  breakdown: SettlementBreakdown;
  transactionCount: number;
}

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

/**
 * docs/08_割り勘計算 仕様書.md 4章のAPI仕様に対応するDB取得込みラッパー。
 * 精算方向・金額の判定は calculateSettlement() を呼ぶのみで、ここでは再実装しない。
 */
export async function getMonthlySettlement(
  householdId: bigint,
  year: number,
  month: number
): Promise<MonthlySettlementResult> {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new SettlementValidationError('year・monthが不正です');
  }

  const users = await prisma.user.findMany({ where: { householdId }, orderBy: { id: 'asc' } });
  if (users.length !== 2) {
    throw new SettlementValidationError('精算計算は世帯人数が2人の場合のみ対応しています');
  }
  const [userA, userB] = users;

  const { start, end } = monthRange(year, month);
  const transactions = await prisma.transaction.findMany({
    where: {
      householdId,
      transactionDate: { gte: start, lt: end },
      settlementPayerUserId: { not: null },
    },
    select: {
      settlementPayerUserId: true,
      settlementBurden: true,
      settlementPartialAmount: true,
      amount: true,
    },
  });

  const result = calculateSettlement(
    transactions.map((t) => ({
      settlementPayerUserId: t.settlementPayerUserId,
      settlementBurden: t.settlementBurden,
      settlementPartialAmount: t.settlementPartialAmount === null ? null : Number(t.settlementPartialAmount),
      amount: Number(t.amount),
    })),
    [userA.id, userB.id]
  );

  const toSummary = (u: typeof userA): SettlementUserSummary => ({
    userId: u.id.toString(),
    displayName: u.displayName,
  });

  const fromUser = result.direction === 'NONE' ? null : result.direction === 'A_TO_B' ? toSummary(userA) : toSummary(userB);
  const toUser = result.direction === 'NONE' ? null : result.direction === 'A_TO_B' ? toSummary(userB) : toSummary(userA);

  return {
    year,
    month,
    direction: result.direction,
    fromUser,
    toUser,
    amount: result.amount,
    breakdown: result.breakdown,
    transactionCount: result.transactionCount,
  };
}
