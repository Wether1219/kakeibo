import { Router } from 'express';
import { SplitType } from '@prisma/client';
import { HouseholdRequest, authMiddleware } from '../middlewares/household';
import {
  RecurringTransactionInput,
  RecurringTransactionNotFoundError,
  RecurringTransactionValidationError,
  createRecurringTransaction,
  listRecurringTransactions,
  updateRecurringTransaction,
} from '../services/recurringTransactionService';
import { recordAuditLog } from '../services/auditLogService';

const SPLIT_TYPES = Object.values(SplitType);

function isSplitType(value: unknown): value is SplitType {
  return typeof value === 'string' && (SPLIT_TYPES as string[]).includes(value);
}

function isPositiveIntString(value: unknown): value is string {
  return typeof value === 'string' && /^\d+$/.test(value);
}

function serializeRecurringTransaction(rt: {
  id: bigint;
  householdId: bigint;
  categoryId: bigint;
  splitType: SplitType;
  userId: bigint | null;
  amount: { toString(): string };
  memo: string | null;
  dayOfMonth: number;
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: rt.id.toString(),
    householdId: rt.householdId.toString(),
    categoryId: rt.categoryId.toString(),
    splitType: rt.splitType,
    userId: rt.userId?.toString() ?? null,
    amount: Number(rt.amount.toString()),
    memo: rt.memo,
    dayOfMonth: rt.dayOfMonth,
    isActive: rt.isActive,
    createdAt: rt.createdAt.toISOString(),
  };
}

function parseBody(body: unknown): RecurringTransactionInput | null {
  const { categoryId, splitType, userId, amount, memo, dayOfMonth } =
    (body as Record<string, unknown>) ?? {};
  if (
    !isPositiveIntString(String(categoryId)) ||
    !isSplitType(splitType) ||
    typeof amount !== 'number' ||
    typeof dayOfMonth !== 'number'
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
    categoryId: BigInt(categoryId as string | number),
    splitType,
    userId: userId !== undefined && userId !== null ? BigInt(userId as string | number) : null,
    amount,
    memo: (memo as string | undefined) ?? null,
    dayOfMonth,
  };
}

export const recurringTransactionsRouter = Router();
recurringTransactionsRouter.use(authMiddleware);

recurringTransactionsRouter.get('/', async (req: HouseholdRequest, res) => {
  const recurrences = await listRecurringTransactions(req.householdId!);
  res.json(recurrences.map(serializeRecurringTransaction));
});

recurringTransactionsRouter.post('/', async (req: HouseholdRequest, res) => {
  const input = parseBody(req.body);
  if (!input) {
    res.status(400).json({ error: 'categoryId, splitType, amount, dayOfMonthは必須です' });
    return;
  }
  try {
    const rt = await createRecurringTransaction(req.householdId!, input);
    await recordAuditLog({
      householdId: req.householdId!,
      userId: req.userId!,
      targetTable: 'recurring_transactions',
      targetId: rt.id,
      action: 'create',
      diff: { after: serializeRecurringTransaction(rt) },
    });
    res.status(201).json(serializeRecurringTransaction(rt));
  } catch (e) {
    if (e instanceof RecurringTransactionValidationError) {
      res.status(400).json({ error: e.message });
      return;
    }
    throw e;
  }
});

recurringTransactionsRouter.put('/:id', async (req: HouseholdRequest, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    res.status(400).json({ error: 'idが不正です' });
    return;
  }
  const { categoryId, splitType, userId, amount, memo, dayOfMonth, isActive } = req.body ?? {};
  if (categoryId !== undefined && !isPositiveIntString(String(categoryId))) {
    res.status(400).json({ error: 'categoryIdが不正です' });
    return;
  }
  if (splitType !== undefined && !isSplitType(splitType)) {
    res.status(400).json({ error: 'splitTypeが不正です' });
    return;
  }
  if (userId !== undefined && userId !== null && !isPositiveIntString(String(userId))) {
    res.status(400).json({ error: 'userIdが不正です' });
    return;
  }
  if (amount !== undefined && typeof amount !== 'number') {
    res.status(400).json({ error: 'amountが不正です' });
    return;
  }
  if (dayOfMonth !== undefined && typeof dayOfMonth !== 'number') {
    res.status(400).json({ error: 'dayOfMonthが不正です' });
    return;
  }
  if (isActive !== undefined && typeof isActive !== 'boolean') {
    res.status(400).json({ error: 'isActiveが不正です' });
    return;
  }
  try {
    const { before, after } = await updateRecurringTransaction(req.householdId!, BigInt(req.params.id), {
      categoryId: categoryId !== undefined ? BigInt(categoryId as string | number) : undefined,
      splitType,
      userId: userId !== undefined ? (userId === null ? null : BigInt(userId as string | number)) : undefined,
      amount,
      memo,
      dayOfMonth,
      isActive,
    });
    await recordAuditLog({
      householdId: req.householdId!,
      userId: req.userId!,
      targetTable: 'recurring_transactions',
      targetId: after.id,
      action: 'update',
      diff: {
        before: serializeRecurringTransaction(before),
        after: serializeRecurringTransaction(after),
      },
    });
    res.json(serializeRecurringTransaction(after));
  } catch (e) {
    if (e instanceof RecurringTransactionNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    if (e instanceof RecurringTransactionValidationError) {
      res.status(400).json({ error: e.message });
      return;
    }
    throw e;
  }
});
