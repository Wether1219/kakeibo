import { Router } from 'express';
import { HouseholdRequest, authMiddleware } from '../middlewares/household';
import {
  SavingsGoalNotFoundError,
  SavingsGoalValidationError,
  createSavingsGoal,
  listSavingsGoals,
  updateSavingsGoal,
} from '../services/savingsGoalService';
import { recordAuditLog } from '../services/auditLogService';

function serializeSavingsGoal(goal: {
  id: bigint;
  householdId: bigint;
  name: string;
  targetAmount: { toString(): string };
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: goal.id.toString(),
    householdId: goal.householdId.toString(),
    name: goal.name,
    targetAmount: Number(goal.targetAmount.toString()),
    isActive: goal.isActive,
    createdAt: goal.createdAt.toISOString(),
  };
}

export const savingsGoalsRouter = Router();
savingsGoalsRouter.use(authMiddleware);

savingsGoalsRouter.get('/', async (req: HouseholdRequest, res) => {
  const goals = await listSavingsGoals(req.householdId!);
  res.json(goals.map(serializeSavingsGoal));
});

savingsGoalsRouter.post('/', async (req: HouseholdRequest, res) => {
  const { name, targetAmount } = req.body ?? {};
  if (typeof name !== 'string' || typeof targetAmount !== 'number') {
    res.status(400).json({ error: 'name, targetAmountは必須です' });
    return;
  }
  try {
    const goal = await createSavingsGoal(req.householdId!, { name, targetAmount });
    await recordAuditLog({
      householdId: req.householdId!,
      userId: req.userId!,
      targetTable: 'savings_goals',
      targetId: goal.id,
      action: 'create',
      diff: { after: serializeSavingsGoal(goal) },
    });
    res.status(201).json(serializeSavingsGoal(goal));
  } catch (e) {
    if (e instanceof SavingsGoalValidationError) {
      res.status(400).json({ error: e.message });
      return;
    }
    throw e;
  }
});

savingsGoalsRouter.put('/:id', async (req: HouseholdRequest, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    res.status(400).json({ error: 'idが不正です' });
    return;
  }
  const { name, targetAmount, isActive } = req.body ?? {};
  if (name !== undefined && typeof name !== 'string') {
    res.status(400).json({ error: 'nameが不正です' });
    return;
  }
  if (targetAmount !== undefined && typeof targetAmount !== 'number') {
    res.status(400).json({ error: 'targetAmountが不正です' });
    return;
  }
  if (isActive !== undefined && typeof isActive !== 'boolean') {
    res.status(400).json({ error: 'isActiveが不正です' });
    return;
  }
  try {
    const { before, after } = await updateSavingsGoal(req.householdId!, BigInt(req.params.id), {
      name,
      targetAmount,
      isActive,
    });
    await recordAuditLog({
      householdId: req.householdId!,
      userId: req.userId!,
      targetTable: 'savings_goals',
      targetId: after.id,
      action: 'update',
      diff: { before: serializeSavingsGoal(before), after: serializeSavingsGoal(after) },
    });
    res.json(serializeSavingsGoal(after));
  } catch (e) {
    if (e instanceof SavingsGoalNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    if (e instanceof SavingsGoalValidationError) {
      res.status(400).json({ error: e.message });
      return;
    }
    throw e;
  }
});
