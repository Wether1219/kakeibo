import { Router } from 'express';
import { HouseholdRequest, householdMiddleware, userMiddleware } from '../middlewares/household';
import {
  PreSavingInput,
  PreSavingValidationError,
  bulkUpsertPreSavings,
  listPreSavings,
} from '../services/preSavingService';
import { recordAuditLogs } from '../services/auditLogService';

function isPositiveIntString(value: unknown): value is string {
  return typeof value === 'string' && /^\d+$/.test(value);
}

function serializePreSaving(preSaving: {
  id: bigint;
  householdId: bigint;
  year: number;
  month: number;
  userId: bigint;
  categoryId: bigint;
  budgetAmount: { toString(): string };
  actualAmount: { toString(): string };
  createdAt: Date;
}) {
  return {
    id: preSaving.id.toString(),
    householdId: preSaving.householdId.toString(),
    year: preSaving.year,
    month: preSaving.month,
    userId: preSaving.userId.toString(),
    categoryId: preSaving.categoryId.toString(),
    budgetAmount: Number(preSaving.budgetAmount.toString()),
    actualAmount: Number(preSaving.actualAmount.toString()),
    createdAt: preSaving.createdAt.toISOString(),
  };
}

function parsePreSavingItem(item: unknown): PreSavingInput | null {
  const { year, month, userId, categoryId, budgetAmount, actualAmount } =
    (item as Record<string, unknown>) ?? {};
  if (
    typeof year !== 'number' ||
    typeof month !== 'number' ||
    !isPositiveIntString(String(userId)) ||
    !isPositiveIntString(String(categoryId)) ||
    typeof actualAmount !== 'number'
  ) {
    return null;
  }
  if (budgetAmount !== undefined && typeof budgetAmount !== 'number') {
    return null;
  }
  return {
    year,
    month,
    userId: BigInt(userId as string | number),
    categoryId: BigInt(categoryId as string | number),
    budgetAmount: (budgetAmount as number | undefined) ?? 0,
    actualAmount,
  };
}

export const preSavingsRouter = Router();
preSavingsRouter.use(householdMiddleware);

preSavingsRouter.get('/', async (req: HouseholdRequest, res) => {
  const { year, month } = req.query;
  if (year !== undefined && !/^\d+$/.test(String(year))) {
    res.status(400).json({ error: 'yearが不正です' });
    return;
  }
  if (month !== undefined && !/^\d+$/.test(String(month))) {
    res.status(400).json({ error: 'monthが不正です' });
    return;
  }
  const preSavings = await listPreSavings(req.householdId!, {
    year: year !== undefined ? Number(year) : undefined,
    month: month !== undefined ? Number(month) : undefined,
  });
  res.json(preSavings.map(serializePreSaving));
});

preSavingsRouter.put('/bulk', userMiddleware, async (req: HouseholdRequest, res) => {
  if (!Array.isArray(req.body)) {
    res.status(400).json({ error: 'リクエストボディは配列である必要があります' });
    return;
  }
  const items = req.body.map(parsePreSavingItem);
  if (items.some((item) => item === null)) {
    res.status(400).json({ error: 'year, month, userId, categoryId, actualAmountは必須です' });
    return;
  }
  try {
    const upserted = await bulkUpsertPreSavings(req.householdId!, items as PreSavingInput[]);
    await recordAuditLogs(
      upserted.map(({ result, before }) => ({
        householdId: req.householdId!,
        userId: req.userId!,
        targetTable: 'pre_savings',
        targetId: result.id,
        action: before ? ('update' as const) : ('create' as const),
        diff: {
          before: before ? serializePreSaving(before) : undefined,
          after: serializePreSaving(result),
        },
      }))
    );
    res.json(upserted.map(({ result }) => serializePreSaving(result)));
  } catch (e) {
    if (e instanceof PreSavingValidationError) {
      res.status(400).json({ error: e.message });
      return;
    }
    throw e;
  }
});
