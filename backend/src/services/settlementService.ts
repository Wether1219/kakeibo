import { prisma } from '../prisma';
import { calculateSettlement, SettlementTransaction } from './summaryLogic';

export class SettlementValidationError extends Error {}

export interface SettlementMember {
  userId: string;
  displayName: string;
}

export interface SettlementBreakdownRow {
  userId: string;
  displayName: string;
  sharedPaidTotal: number;
  sharedOtherPaidTotal: number;
  paidForOtherTotal: number;
  paidForOtherOtherPaidTotal: number;
}

export interface SettlementSummary {
  startDate: string;
  endDate: string;
  members: SettlementMember[];
  breakdown: SettlementBreakdownRow[];
  netAmount: number;
  fromUserId: string | null;
  fromDisplayName: string | null;
  toUserId: string | null;
  toDisplayName: string | null;
}

function parseDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  return date;
}

export async function getSettlementSummary(
  householdId: bigint,
  startDateStr: string,
  endDateStr: string
): Promise<SettlementSummary> {
  const start = parseDate(startDateStr);
  const endExclusive = parseDate(endDateStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(endExclusive.getTime())) {
    throw new SettlementValidationError('startDate・endDateが不正です');
  }
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  if (start.getTime() >= endExclusive.getTime()) {
    throw new SettlementValidationError('startDateはendDate以前である必要があります');
  }

  const users = await prisma.user.findMany({ where: { householdId }, orderBy: { id: 'asc' } });
  if (users.length !== 2) {
    throw new SettlementValidationError('精算機能は世帯人数が2人の場合のみ利用できます');
  }
  const memberIds: [bigint, bigint] = [users[0].id, users[1].id];

  const transactions = await prisma.transaction.findMany({
    where: {
      householdId,
      transactionDate: { gte: start, lt: endExclusive },
      category: { type: { in: ['fixed_expense', 'variable_expense'] } },
    },
  });

  const settlementTransactions: SettlementTransaction[] = transactions.map((t) => ({
    splitType: t.splitType,
    userId: t.userId,
    createdBy: t.createdBy,
    amount: Number(t.amount),
    otherPaidAmount: t.otherPaidAmount === null ? null : Number(t.otherPaidAmount),
  }));

  const result = calculateSettlement(settlementTransactions, memberIds);

  const members: SettlementMember[] = users.map((u) => ({
    userId: u.id.toString(),
    displayName: u.displayName,
  }));

  const breakdown: SettlementBreakdownRow[] = result.breakdown.map((row, index) => ({
    userId: members[index].userId,
    displayName: members[index].displayName,
    sharedPaidTotal: row.sharedPaidTotal,
    sharedOtherPaidTotal: row.sharedOtherPaidTotal,
    paidForOtherTotal: row.paidForOtherTotal,
    paidForOtherOtherPaidTotal: row.paidForOtherOtherPaidTotal,
  }));

  const fromIndex = result.payerIndex;
  const toIndex = fromIndex === null ? null : fromIndex === 0 ? 1 : 0;

  return {
    startDate: startDateStr,
    endDate: endDateStr,
    members,
    breakdown,
    netAmount: result.netAmount,
    fromUserId: fromIndex === null ? null : members[fromIndex].userId,
    fromDisplayName: fromIndex === null ? null : members[fromIndex].displayName,
    toUserId: toIndex === null ? null : members[toIndex].userId,
    toDisplayName: toIndex === null ? null : members[toIndex].displayName,
  };
}
