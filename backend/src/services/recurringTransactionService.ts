import { SplitType } from '@prisma/client';
import { prisma } from '../prisma';

export class RecurringTransactionNotFoundError extends Error {}
export class RecurringTransactionValidationError extends Error {}

async function assertCategory(householdId: bigint, categoryId: bigint) {
  const category = await prisma.category.findFirst({ where: { id: categoryId, householdId } });
  if (!category || !['fixed_expense', 'variable_expense'].includes(category.type)) {
    throw new RecurringTransactionValidationError(
      'categoryIdは固定費または変動費の費目である必要があります'
    );
  }
}

async function assertUserInHousehold(householdId: bigint, userId: bigint) {
  const user = await prisma.user.findFirst({ where: { id: userId, householdId } });
  if (!user) {
    throw new RecurringTransactionValidationError('userIdが不正です');
  }
}

function validateCommon(data: { amount: number; dayOfMonth: number }) {
  if (!Number.isInteger(data.amount) || data.amount < 1) {
    throw new RecurringTransactionValidationError('金額は1円以上の整数である必要があります');
  }
  if (!Number.isInteger(data.dayOfMonth) || data.dayOfMonth < 1 || data.dayOfMonth > 28) {
    throw new RecurringTransactionValidationError('dayOfMonthは1〜28の整数である必要があります');
  }
}

export async function listRecurringTransactions(householdId: bigint) {
  return prisma.recurringTransaction.findMany({
    where: { householdId },
    orderBy: { id: 'asc' },
  });
}

export interface RecurringTransactionInput {
  categoryId: bigint;
  splitType: SplitType;
  userId?: bigint | null;
  amount: number;
  memo?: string | null;
  dayOfMonth: number;
}

export async function createRecurringTransaction(
  householdId: bigint,
  data: RecurringTransactionInput
) {
  validateCommon(data);
  await assertCategory(householdId, data.categoryId);
  if (data.splitType === 'self') {
    if (data.userId === undefined || data.userId === null) {
      throw new RecurringTransactionValidationError('splitTypeがselfの場合、userIdは必須です');
    }
    await assertUserInHousehold(householdId, data.userId);
  }
  return prisma.recurringTransaction.create({
    data: {
      householdId,
      categoryId: data.categoryId,
      splitType: data.splitType,
      userId: data.splitType === 'shared' ? null : data.userId ?? null,
      amount: data.amount,
      memo: data.memo ?? null,
      dayOfMonth: data.dayOfMonth,
    },
  });
}

export interface UpdateRecurringTransactionInput {
  categoryId?: bigint;
  splitType?: SplitType;
  userId?: bigint | null;
  amount?: number;
  memo?: string | null;
  dayOfMonth?: number;
  isActive?: boolean;
}

export async function updateRecurringTransaction(
  householdId: bigint,
  id: bigint,
  data: UpdateRecurringTransactionInput
) {
  const existing = await prisma.recurringTransaction.findFirst({ where: { id, householdId } });
  if (!existing) {
    throw new RecurringTransactionNotFoundError('定期取引が見つかりません');
  }
  validateCommon({
    amount: data.amount ?? Number(existing.amount),
    dayOfMonth: data.dayOfMonth ?? existing.dayOfMonth,
  });
  if (data.categoryId !== undefined) {
    await assertCategory(householdId, data.categoryId);
  }
  const nextSplitType = data.splitType ?? existing.splitType;
  const nextUserId = data.userId !== undefined ? data.userId : existing.userId;
  if (nextSplitType === 'self') {
    if (nextUserId === null || nextUserId === undefined) {
      throw new RecurringTransactionValidationError('splitTypeがselfの場合、userIdは必須です');
    }
    await assertUserInHousehold(householdId, nextUserId);
  }
  const after = await prisma.recurringTransaction.update({
    where: { id },
    data: {
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      ...(data.splitType !== undefined ? { splitType: data.splitType } : {}),
      ...(data.splitType !== undefined || data.userId !== undefined
        ? { userId: nextSplitType === 'shared' ? null : nextUserId }
        : {}),
      ...(data.amount !== undefined ? { amount: data.amount } : {}),
      ...(data.memo !== undefined ? { memo: data.memo } : {}),
      ...(data.dayOfMonth !== undefined ? { dayOfMonth: data.dayOfMonth } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });
  return { before: existing, after };
}

function clampDayOfMonth(year: number, month: number, dayOfMonth: number): number {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Math.min(dayOfMonth, daysInMonth);
}

// 指定年月について、まだその月分の取引が生成されていない有効な定期取引から取引を自動生成する。
// 既に生成済み（同じrecurringTransactionIdの取引がその月に存在する）ものはスキップするため、
// 同じ月に対して複数回呼び出しても重複生成されない。
export async function generateDueTransactions(
  householdId: bigint,
  year: number,
  month: number,
  triggeredByUserId: bigint
): Promise<{ generatedCount: number }> {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  const recurrences = await prisma.recurringTransaction.findMany({
    where: { householdId, isActive: true },
  });
  if (recurrences.length === 0) {
    return { generatedCount: 0 };
  }

  const alreadyGenerated = await prisma.transaction.findMany({
    where: {
      householdId,
      transactionDate: { gte: monthStart, lt: monthEnd },
      recurringTransactionId: { in: recurrences.map((r) => r.id) },
    },
    select: { recurringTransactionId: true },
  });
  const generatedIds = new Set(alreadyGenerated.map((t) => t.recurringTransactionId));

  const due = recurrences.filter((r) => !generatedIds.has(r.id));
  if (due.length === 0) {
    return { generatedCount: 0 };
  }

  await prisma.$transaction(
    due.map((r) =>
      prisma.transaction.create({
        data: {
          householdId,
          transactionDate: new Date(
            Date.UTC(year, month - 1, clampDayOfMonth(year, month, r.dayOfMonth))
          ),
          categoryId: r.categoryId,
          splitType: r.splitType,
          userId: r.userId,
          amount: r.amount,
          memo: r.memo,
          createdBy: r.userId ?? triggeredByUserId,
          recurringTransactionId: r.id,
        },
      })
    )
  );

  return { generatedCount: due.length };
}
