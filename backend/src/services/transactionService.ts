import { Prisma, SettlementBurden, SplitType } from '@prisma/client';
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
  otherPaidAmount?: number | null;
  settlementPayerUserId?: bigint | null;
  settlementBurden?: SettlementBurden | null;
  settlementPartialAmount?: number | null;
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
  if (data.otherPaidAmount !== undefined && data.otherPaidAmount !== null) {
    if (!Number.isInteger(data.otherPaidAmount) || data.otherPaidAmount < 0) {
      throw new TransactionValidationError('相手が払った金額は0円以上の整数である必要があります');
    }
    if (data.otherPaidAmount > data.amount) {
      throw new TransactionValidationError('相手が払った金額は取引金額以下である必要があります');
    }
  }
  const hasSettlementPayer =
    data.settlementPayerUserId !== undefined && data.settlementPayerUserId !== null;
  if (hasSettlementPayer && (data.settlementBurden === undefined || data.settlementBurden === null)) {
    throw new TransactionValidationError(
      'settlementPayerUserIdを指定する場合、settlementBurdenは必須です'
    );
  }
  if (!hasSettlementPayer && data.settlementBurden !== undefined && data.settlementBurden !== null) {
    throw new TransactionValidationError(
      'settlementBurdenを指定する場合、settlementPayerUserIdは必須です'
    );
  }
  if (data.settlementPartialAmount !== undefined && data.settlementPartialAmount !== null) {
    if (!Number.isInteger(data.settlementPartialAmount) || data.settlementPartialAmount < 0) {
      throw new TransactionValidationError('半端額は0円以上の整数である必要があります');
    }
    if (data.settlementPartialAmount > data.amount) {
      throw new TransactionValidationError('半端額は取引金額以下である必要があります');
    }
  }
}

export type TransactionSort = 'date_desc' | 'date_asc';

export interface TransactionListFilter {
  year?: number;
  month?: number;
  categoryId?: bigint;
  keyword?: string;
  splitType?: SplitType;
  userId?: bigint;
  limit?: number;
  offset?: number;
  sort?: TransactionSort;
}

function buildWhere(householdId: bigint, filter: TransactionListFilter): Prisma.TransactionWhereInput {
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
  if (filter.keyword !== undefined && filter.keyword !== '') {
    where.OR = [
      { memo: { contains: filter.keyword } },
      { category: { name: { contains: filter.keyword } } },
    ];
  }
  if (filter.splitType !== undefined) {
    where.splitType = filter.splitType;
  }
  if (filter.userId !== undefined) {
    where.userId = filter.userId;
  }
  return where;
}

export async function listTransactions(householdId: bigint, filter: TransactionListFilter) {
  return prisma.transaction.findMany({
    where: buildWhere(householdId, filter),
    orderBy: { transactionDate: filter.sort === 'date_asc' ? 'asc' : 'desc' },
    take: filter.limit,
    skip: filter.offset,
  });
}

export async function countTransactions(
  householdId: bigint,
  filter: Pick<TransactionListFilter, 'year' | 'month' | 'categoryId' | 'keyword' | 'splitType' | 'userId'>
) {
  return prisma.transaction.count({ where: buildWhere(householdId, filter) });
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
      otherPaidAmount: data.otherPaidAmount ?? null,
      settlementPayerUserId: data.settlementPayerUserId ?? null,
      settlementBurden: data.settlementBurden ?? null,
      settlementPartialAmount: data.settlementPartialAmount ?? null,
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
  const after = await prisma.transaction.update({
    where: { id },
    data: {
      transactionDate: new Date(data.transactionDate),
      categoryId: data.categoryId,
      splitType: data.splitType,
      userId: data.splitType === 'shared' ? null : data.userId ?? null,
      amount: data.amount,
      memo: data.memo ?? null,
      otherPaidAmount: data.otherPaidAmount ?? null,
      settlementPayerUserId: data.settlementPayerUserId ?? null,
      settlementBurden: data.settlementBurden ?? null,
      settlementPartialAmount: data.settlementPartialAmount ?? null,
    },
  });
  return { before: existing, after };
}

export async function deleteTransaction(householdId: bigint, id: bigint) {
  const existing = await prisma.transaction.findFirst({ where: { id, householdId } });
  if (!existing) {
    throw new TransactionNotFoundError('取引が見つかりません');
  }
  await prisma.transaction.delete({ where: { id } });
  return { before: existing };
}
