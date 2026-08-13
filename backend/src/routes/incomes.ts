import { Router } from 'express';
import { HouseholdRequest, householdMiddleware, userMiddleware } from '../middlewares/household';
import {
  IncomeInput,
  IncomeValidationError,
  bulkUpsertIncomes,
  listIncomes,
} from '../services/incomeService';
import { recordAuditLogs } from '../services/auditLogService';

function isPositiveIntString(value: unknown): value is string {
  return typeof value === 'string' && /^\d+$/.test(value);
}

function serializeIncome(income: {
  id: bigint;
  householdId: bigint;
  year: number;
  month: number;
  userId: bigint;
  categoryId: bigint;
  amount: { toString(): string };
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: income.id.toString(),
    householdId: income.householdId.toString(),
    year: income.year,
    month: income.month,
    userId: income.userId.toString(),
    categoryId: income.categoryId.toString(),
    amount: Number(income.amount.toString()),
    createdAt: income.createdAt.toISOString(),
    updatedAt: income.updatedAt.toISOString(),
  };
}

function parseIncomeItem(item: unknown): IncomeInput | null {
  const { year, month, userId, categoryId, amount } = (item as Record<string, unknown>) ?? {};
  if (
    typeof year !== 'number' ||
    typeof month !== 'number' ||
    !isPositiveIntString(String(userId)) ||
    !isPositiveIntString(String(categoryId)) ||
    typeof amount !== 'number'
  ) {
    return null;
  }
  return {
    year,
    month,
    userId: BigInt(userId as string | number),
    categoryId: BigInt(categoryId as string | number),
    amount,
  };
}

export const incomesRouter = Router();
incomesRouter.use(householdMiddleware);

incomesRouter.get('/', async (req: HouseholdRequest, res) => {
  const { year, month } = req.query;
  if (year !== undefined && !/^\d+$/.test(String(year))) {
    res.status(400).json({ error: 'yearが不正です' });
    return;
  }
  if (month !== undefined && !/^\d+$/.test(String(month))) {
    res.status(400).json({ error: 'monthが不正です' });
    return;
  }
  const incomes = await listIncomes(req.householdId!, {
    year: year !== undefined ? Number(year) : undefined,
    month: month !== undefined ? Number(month) : undefined,
  });
  res.json(incomes.map(serializeIncome));
});

incomesRouter.put('/bulk', userMiddleware, async (req: HouseholdRequest, res) => {
  if (!Array.isArray(req.body)) {
    res.status(400).json({ error: 'リクエストボディは配列である必要があります' });
    return;
  }
  const items = req.body.map(parseIncomeItem);
  if (items.some((item) => item === null)) {
    res.status(400).json({ error: 'year, month, userId, categoryId, amountは必須です' });
    return;
  }
  try {
    const upserted = await bulkUpsertIncomes(req.householdId!, items as IncomeInput[]);
    await recordAuditLogs(
      upserted.map(({ result, before }) => ({
        householdId: req.householdId!,
        userId: req.userId!,
        targetTable: 'incomes',
        targetId: result.id,
        action: before ? ('update' as const) : ('create' as const),
        diff: {
          before: before ? serializeIncome(before) : undefined,
          after: serializeIncome(result),
        },
      }))
    );
    res.json(upserted.map(({ result }) => serializeIncome(result)));
  } catch (e) {
    if (e instanceof IncomeValidationError) {
      res.status(400).json({ error: e.message });
      return;
    }
    throw e;
  }
});
