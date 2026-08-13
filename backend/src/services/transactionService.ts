import { Prisma, SplitType } from '@prisma/client';
import { prisma } from '../prisma';

export class TransactionNotFoundError extends Error {}
export class TransactionValidationError extends Error {}

export interface TransactionInput {
  transactionDate: string;
  categoryId: bigint;
  splitType: SplitType;
  userId?: bigint | null;
  amount: number;
  memo?: string | null;
}

function validateInput(data: TransactionInput) {
  const date = new Date(data.transactionDate);
  if (Number.isNaN(date.getTime())) {
    throw new TransactionValidationError('取引日が不正です');
  }
  const currentYear = new Date().getFullYear();
  if (date.getFullYear() !== currentYear) {
    throw new TransactionValidationError('取引日は当年内である必要があります');
  }
  if (!Number.isInteger(data.amount) || data.amount < 1) {
    throw new TransactionValidationError('金額は1円以上の整数である必要があります');
  }
  if (data.splitType === 'self' && (data.userId === undefined || data.userId === null)) {
    throw new TransactionValidationError('splitTypeがselfの場合、userIdは必須です');
  }
}

export async function listTransactions(
  householdId: bigint,
  filter: { year?: number; month?: number; categoryId?: bigint }
) {
  const where: Prisma.TransactionWhereInput = { householdId };
  if (filter.year !== undefined) {
    const month = filter.month;
    const start = new Date(Date.UTC(filter.year, month !== undefined ? month - 1 : 0, 1));
    const end =
      month !== undefined
        ? new Date(Date.UTC(filter.year, month, 1))
        : new Date(Date.UTC(filter.year + 1, 0, 1));
    where.transactionDate = { gte: start, lt: end };
  }
  if (filter.categoryId !== undefined) {
    where.categoryId = filter.categoryId;
  }
  return prisma.transaction.findMany({
    where,
    orderBy: { transactionDate: 'desc' },
  });
}

export async function createTransaction(
  householdId: bigint,
  createdBy: bigint,
  data: TransactionInput
) {
  validateInput(data);
  return prisma.transaction.create({
    data: {
      householdId,
      transactionDate: new Date(data.transactionDate),
      categoryId: data.categoryId,
      splitType: data.splitType,
      userId: data.splitType === 'shared' ? null : data.userId ?? null,
      amount: data.amount,
      memo: data.memo ?? null,
      createdBy,
    },
  });
}

export async function updateTransaction(
  householdId: bigint,
  id: bigint,
  data: TransactionInput
) {
  validateInput(data);
  const existing = await prisma.transaction.findFirst({ where: { id, householdId } });
  if (!existing) {
    throw new TransactionNotFoundError('取引が見つかりません');
  }
  return prisma.transaction.update({
    where: { id },
    data: {
      transactionDate: new Date(data.transactionDate),
      categoryId: data.categoryId,
      splitType: data.splitType,
      userId: data.splitType === 'shared' ? null : data.userId ?? null,
      amount: data.amount,
      memo: data.memo ?? null,
    },
  });
}

export async function deleteTransaction(householdId: bigint, id: bigint) {
  const existing = await prisma.transaction.findFirst({ where: { id, householdId } });
  if (!existing) {
    throw new TransactionNotFoundError('取引が見つかりません');
  }
  await prisma.transaction.delete({ where: { id } });
}
