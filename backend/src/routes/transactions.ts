import { Router } from 'express';
import { SettlementBurden, SplitType } from '@prisma/client';
import { HouseholdRequest, authMiddleware } from '../middlewares/household';
import {
  TransactionInput,
  TransactionNotFoundError,
  TransactionValidationError,
  countTransactions,
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from '../services/transactionService';
import { recordAuditLog } from '../services/auditLogService';

const SPLIT_TYPES = Object.values(SplitType);
const SETTLEMENT_BURDENS = Object.values(SettlementBurden);

function isSplitType(value: unknown): value is SplitType {
  return typeof value === 'string' && (SPLIT_TYPES as string[]).includes(value);
}

function isSettlementBurden(value: unknown): value is SettlementBurden {
  return typeof value === 'string' && (SETTLEMENT_BURDENS as string[]).includes(value);
}

function isPositiveIntString(value: unknown): value is string {
  return typeof value === 'string' && /^\d+$/.test(value);
}

function serializeTransaction(transaction: {
  id: bigint;
  householdId: bigint;
  transactionDate: Date;
  categoryId: bigint;
  splitType: SplitType;
  userId: bigint | null;
  amount: { toString(): string };
  memo: string | null;
  otherPaidAmount: { toString(): string } | null;
  settlementPayerUserId: bigint | null;
  settlementBurden: SettlementBurden | null;
  settlementPartialAmount: { toString(): string } | null;
  createdBy: bigint;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: transaction.id.toString(),
    householdId: transaction.householdId.toString(),
    transactionDate: transaction.transactionDate.toISOString().slice(0, 10),
    categoryId: transaction.categoryId.toString(),
    splitType: transaction.splitType,
    userId: transaction.userId?.toString() ?? null,
    amount: Number(transaction.amount.toString()),
    memo: transaction.memo,
    otherPaidAmount:
      transaction.otherPaidAmount === null ? null : Number(transaction.otherPaidAmount.toString()),
    settlementPayerUserId: transaction.settlementPayerUserId?.toString() ?? null,
    settlementBurden: transaction.settlementBurden,
    settlementPartialAmount:
      transaction.settlementPartialAmount === null
        ? null
        : Number(transaction.settlementPartialAmount.toString()),
    createdBy: transaction.createdBy.toString(),
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
  };
}

function parseTransactionBody(body: unknown): TransactionInput | null {
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
  } = (body as Record<string, unknown>) ?? {};
  if (
    typeof transactionDate !== 'string' ||
    !isPositiveIntString(String(categoryId)) ||
    !isSplitType(splitType) ||
    typeof amount !== 'number'
  ) {
    return null;
  }
  if (userId !== undefined && userId !== null && !isPositiveIntString(String(userId))) {
    return null;
  }
  if (memo !== undefined && memo !== null && typeof memo !== 'string') {
    return null;
  }
  if (
    otherPaidAmount !== undefined &&
    otherPaidAmount !== null &&
    typeof otherPaidAmount !== 'number'
  ) {
    return null;
  }
  if (
    settlementPayerUserId !== undefined &&
    settlementPayerUserId !== null &&
    !isPositiveIntString(String(settlementPayerUserId))
  ) {
    return null;
  }
  if (
    settlementBurden !== undefined &&
    settlementBurden !== null &&
    !isSettlementBurden(settlementBurden)
  ) {
    return null;
  }
  if (
    settlementPartialAmount !== undefined &&
    settlementPartialAmount !== null &&
    typeof settlementPartialAmount !== 'number'
  ) {
    return null;
  }
  return {
    transactionDate,
    categoryId: BigInt(categoryId as string | number),
    splitType,
    userId: userId !== undefined && userId !== null ? BigInt(userId as string | number) : null,
    amount,
    memo: (memo as string | undefined) ?? null,
    otherPaidAmount: (otherPaidAmount as number | undefined) ?? null,
    settlementPayerUserId:
      settlementPayerUserId !== undefined && settlementPayerUserId !== null
        ? BigInt(settlementPayerUserId as string | number)
        : null,
    settlementBurden: (settlementBurden as SettlementBurden | undefined) ?? null,
    settlementPartialAmount: (settlementPartialAmount as number | undefined) ?? null,
  };
}

export const transactionsRouter = Router();
transactionsRouter.use(authMiddleware);

transactionsRouter.get('/', async (req: HouseholdRequest, res) => {
  const { year, month, categoryId, keyword, target, limit, offset, sort } = req.query;
  if (year !== undefined && !/^\d+$/.test(String(year))) {
    res.status(400).json({ error: 'yearが不正です' });
    return;
  }
  if (month !== undefined && !/^\d+$/.test(String(month))) {
    res.status(400).json({ error: 'monthが不正です' });
    return;
  }
  if (categoryId !== undefined && !/^\d+$/.test(String(categoryId))) {
    res.status(400).json({ error: 'categoryIdが不正です' });
    return;
  }
  // target: 対象者フィルタ。'shared'（共通）または対象ユーザーのuserId（自分/相手）を指定する。
  if (target !== undefined && target !== 'shared' && !/^\d+$/.test(String(target))) {
    res.status(400).json({ error: 'targetが不正です' });
    return;
  }
  if (limit !== undefined && !/^[1-9]\d*$/.test(String(limit))) {
    res.status(400).json({ error: 'limitが不正です' });
    return;
  }
  if (offset !== undefined && !/^\d+$/.test(String(offset))) {
    res.status(400).json({ error: 'offsetが不正です' });
    return;
  }
  if (sort !== undefined && sort !== 'date_desc' && sort !== 'date_asc') {
    res.status(400).json({ error: 'sortが不正です' });
    return;
  }
  const filter = {
    year: year !== undefined ? Number(year) : undefined,
    month: month !== undefined ? Number(month) : undefined,
    categoryId: categoryId !== undefined ? BigInt(String(categoryId)) : undefined,
    keyword: keyword !== undefined ? String(keyword) : undefined,
    splitType: target === 'shared' ? ('shared' as SplitType) : target !== undefined ? ('self' as SplitType) : undefined,
    userId: target !== undefined && target !== 'shared' ? BigInt(String(target)) : undefined,
    limit: limit !== undefined ? Number(limit) : undefined,
    offset: offset !== undefined ? Number(offset) : undefined,
    sort: sort as 'date_desc' | 'date_asc' | undefined,
  };
  const [transactions, total] = await Promise.all([
    listTransactions(req.householdId!, filter),
    countTransactions(req.householdId!, filter),
  ]);
  res.setHeader('X-Total-Count', String(total));
  res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count');
  res.json(transactions.map(serializeTransaction));
});

transactionsRouter.post('/', async (req: HouseholdRequest, res) => {
  const input = parseTransactionBody(req.body);
  if (!input) {
    res.status(400).json({ error: 'transactionDate, categoryId, splitType, amountは必須です' });
    return;
  }
  try {
    const transaction = await createTransaction(req.householdId!, req.userId!, input);
    await recordAuditLog({
      householdId: req.householdId!,
      userId: req.userId!,
      targetTable: 'transactions',
      targetId: transaction.id,
      action: 'create',
      diff: { after: serializeTransaction(transaction) },
    });
    res.status(201).json(serializeTransaction(transaction));
  } catch (e) {
    if (e instanceof TransactionValidationError) {
      res.status(400).json({ error: e.message });
      return;
    }
    throw e;
  }
});

transactionsRouter.put('/:id', async (req: HouseholdRequest, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    res.status(400).json({ error: 'idが不正です' });
    return;
  }
  const input = parseTransactionBody(req.body);
  if (!input) {
    res.status(400).json({ error: 'transactionDate, categoryId, splitType, amountは必須です' });
    return;
  }
  try {
    const { before, after } = await updateTransaction(req.householdId!, BigInt(req.params.id), input);
    await recordAuditLog({
      householdId: req.householdId!,
      userId: req.userId!,
      targetTable: 'transactions',
      targetId: after.id,
      action: 'update',
      diff: { before: serializeTransaction(before), after: serializeTransaction(after) },
    });
    res.json(serializeTransaction(after));
  } catch (e) {
    if (e instanceof TransactionNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    if (e instanceof TransactionValidationError) {
      res.status(400).json({ error: e.message });
      return;
    }
    throw e;
  }
});

transactionsRouter.delete('/:id', async (req: HouseholdRequest, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    res.status(400).json({ error: 'idが不正です' });
    return;
  }
  try {
    const { before } = await deleteTransaction(req.householdId!, BigInt(req.params.id));
    await recordAuditLog({
      householdId: req.householdId!,
      userId: req.userId!,
      targetTable: 'transactions',
      targetId: before.id,
      action: 'delete',
      diff: { before: serializeTransaction(before) },
    });
    res.status(204).send();
  } catch (e) {
    if (e instanceof TransactionNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    throw e;
  }
});
