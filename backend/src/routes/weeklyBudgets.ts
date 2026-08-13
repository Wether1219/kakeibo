import { Router } from 'express';
import { HouseholdRequest, householdMiddleware } from '../middlewares/household';
import {
  WeeklyBudgetInput,
  WeeklyBudgetValidationError,
  bulkUpsertWeeklyBudgets,
  listWeeklyBudgetsWithActual,
} from '../services/weeklyBudgetService';

function isPositiveIntString(value: unknown): value is string {
  return typeof value === 'string' && /^\d+$/.test(value);
}

function serializeWeeklyBudget(weeklyBudget: {
  id: bigint;
  householdId: bigint;
  year: number;
  month: number;
  weekNo: number;
  categoryId: bigint;
  budgetAmount: { toString(): string };
}) {
  return {
    id: weeklyBudget.id.toString(),
    householdId: weeklyBudget.householdId.toString(),
    year: weeklyBudget.year,
    month: weeklyBudget.month,
    weekNo: weeklyBudget.weekNo,
    categoryId: weeklyBudget.categoryId.toString(),
    budgetAmount: Number(weeklyBudget.budgetAmount.toString()),
  };
}

function parseWeeklyBudgetItem(item: unknown): WeeklyBudgetInput | null {
  const { year, month, weekNo, categoryId, budgetAmount } =
    (item as Record<string, unknown>) ?? {};
  if (
    typeof year !== 'number' ||
    typeof month !== 'number' ||
    typeof weekNo !== 'number' ||
    !isPositiveIntString(String(categoryId)) ||
    typeof budgetAmount !== 'number'
  ) {
    return null;
  }
  return {
    year,
    month,
    weekNo,
    categoryId: BigInt(categoryId as string | number),
    budgetAmount,
  };
}

export const weeklyBudgetsRouter = Router();
weeklyBudgetsRouter.use(householdMiddleware);

weeklyBudgetsRouter.get('/', async (req: HouseholdRequest, res) => {
  const { year, month } = req.query;
  if (!/^\d+$/.test(String(year ?? '')) || !/^\d+$/.test(String(month ?? ''))) {
    res.status(400).json({ error: 'year・monthは必須です' });
    return;
  }
  try {
    const rows = await listWeeklyBudgetsWithActual(req.householdId!, Number(year), Number(month));
    res.json(rows);
  } catch (e) {
    if (e instanceof WeeklyBudgetValidationError) {
      res.status(400).json({ error: e.message });
      return;
    }
    throw e;
  }
});

weeklyBudgetsRouter.put('/bulk', async (req: HouseholdRequest, res) => {
  if (!Array.isArray(req.body)) {
    res.status(400).json({ error: 'リクエストボディは配列である必要があります' });
    return;
  }
  const items = req.body.map(parseWeeklyBudgetItem);
  if (items.some((item) => item === null)) {
    res.status(400).json({ error: 'year, month, weekNo, categoryId, budgetAmountは必須です' });
    return;
  }
  try {
    const weeklyBudgets = await bulkUpsertWeeklyBudgets(req.householdId!, items as WeeklyBudgetInput[]);
    res.json(weeklyBudgets.map(serializeWeeklyBudget));
  } catch (e) {
    if (e instanceof WeeklyBudgetValidationError) {
      res.status(400).json({ error: e.message });
      return;
    }
    throw e;
  }
});
