import { Router } from 'express';
import { SplitType } from '@prisma/client';
import { HouseholdRequest, householdMiddleware, userMiddleware } from '../middlewares/household';
import {
  TransactionInput,
  TransactionNotFoundError,
  TransactionValidationError,
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from '../services/transactionService';
import { recordAuditLog } from '../services/auditLogService';

const SPLIT_TYPES = Object.values(SplitType);

function isSplitType(value: unknown): value is SplitType {
  return typeof value === 'string' && (SPLIT_TYPES as string[]).includes(value);
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
    createdBy: transaction.createdBy.toString(),
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
  };
}

function parseTransactionBody(body: unknown): TransactionInput | null {
  const { transactionDate, categoryId, splitType, userId, amount, memo } =
    (body as Record<string, unknown>) ?? {};
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
  return {
    transactionDate,
    categoryId: BigInt(categoryId as string | number),
    splitType,
    userId: userId !== undefined && userId !== null ? BigInt(userId as string | number) : null,
    amount,
    memo: (memo as string | undefined) ?? null,
  };
}

export const transactionsRouter = Router();
transactionsRouter.use(householdMiddleware);

transactionsRouter.get('/', async (req: HouseholdRequest, res) => {
  const { year, month, categoryId, limit, sort } = req.query;
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
  if (limit !== undefined && !/^[1-9]\d*$/.test(String(limit))) {
    res.status(400).json({ error: 'limitが不正です' });
    return;
  }
  if (sort !== undefined && sort !== 'date_desc') {
    res.status(400).json({ error: 'sortが不正です' });
    return;
  }
  const transactions = await listTransactions(req.householdId!, {
    year: year !== undefined ? Number(year) : undefined,
    month: month !== undefined ? Number(month) : undefined,
    categoryId: categoryId !== undefined ? BigInt(String(categoryId)) : undefined,
    limit: limit !== undefined ? Number(limit) : undefined,
    sort: sort as 'date_desc' | undefined,
  });
  res.json(transactions.map(serializeTransaction));
});

transactionsRouter.post('/', userMiddleware, async (req: HouseholdRequest, res) => {
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

transactionsRouter.put('/:id', userMiddleware, async (req: HouseholdRequest, res) => {
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

transactionsRouter.delete('/:id', userMiddleware, async (req: HouseholdRequest, res) => {
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
