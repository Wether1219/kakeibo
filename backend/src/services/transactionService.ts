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
  if (date.getFullYear() < currentYear - 1 || date.getFullYear() > currentYear + 1) {
    throw new TransactionValidationError('取引日は前後1年以内の日付である必要があります');
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

function buildCreateData(householdId: bigint, createdBy: bigint, data: TransactionInput) {
  return {
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
  };
}

export async function createTransaction(
  householdId: bigint,
  createdBy: bigint,
  data: TransactionInput
) {
  validateInput(data);
  return prisma.transaction.create({ data: buildCreateData(householdId, createdBy, data) });
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

// 削除操作の監査ログ（diff_json.before、routes/transactions.tsのserializeTransactionと同じ形）から
// 取引を復元する。before値をそのまま使い回すため、対応するフィールドの型変換のみ行う。
function parseDeletedSnapshot(diffJson: Prisma.JsonValue): TransactionInput & { createdBy: bigint } {
  const before = (diffJson as { before?: Record<string, unknown> } | null)?.before;
  if (!before || typeof before !== 'object') {
    throw new TransactionNotFoundError('復元対象の削除履歴が見つかりません');
  }
  const {
    transactionDate,
    categoryId,
    splitType,
    userId,
    amount,
    memo,
    otherPaidAmount,
    settlementPayerUserId,
    settlementBurden,
    settlementPartialAmount,
    createdBy,
  } = before;
  if (
    typeof transactionDate !== 'string' ||
    typeof categoryId !== 'string' ||
    typeof splitType !== 'string' ||
    typeof amount !== 'number' ||
    typeof createdBy !== 'string'
  ) {
    throw new TransactionNotFoundError('復元対象の削除履歴の形式が不正です');
  }
  return {
    transactionDate,
    categoryId: BigInt(categoryId),
    splitType: splitType as SplitType,
    userId: typeof userId === 'string' ? BigInt(userId) : null,
    amount,
    memo: typeof memo === 'string' ? memo : null,
    otherPaidAmount: typeof otherPaidAmount === 'number' ? otherPaidAmount : null,
    settlementPayerUserId: typeof settlementPayerUserId === 'string' ? BigInt(settlementPayerUserId) : null,
    settlementBurden: (settlementBurden as SettlementBurden | null | undefined) ?? null,
    settlementPartialAmount: typeof settlementPartialAmount === 'number' ? settlementPartialAmount : null,
    createdBy: BigInt(createdBy),
  };
}

export async function restoreTransaction(householdId: bigint, auditLogId: bigint) {
  const log = await prisma.auditLog.findFirst({
    where: { id: auditLogId, householdId, targetTable: 'transactions', action: 'delete' },
  });
  if (!log) {
    // 存在しない/他世帯/対象外アクションのいずれも同一の404にし、他世帯データの存在を推測されないようにする
    throw new TransactionNotFoundError('復元対象の削除履歴が見つかりません');
  }
  const { createdBy, ...data } = parseDeletedSnapshot(log.diffJson);
  // 削除前の状態を忠実に再現するのが目的のため、意図的にvalidateInputを呼ばない
  // （新規入力用のバリデーション、例えばA1で追加した取引日の前後1年チェックにより、
  // 古い削除済み取引が復元できなくなるのを防ぐため）
  return prisma.transaction.create({ data: buildCreateData(householdId, createdBy, data) });
}
