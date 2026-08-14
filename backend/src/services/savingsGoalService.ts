import { prisma } from '../prisma';

export class SavingsGoalNotFoundError extends Error {}
export class SavingsGoalValidationError extends Error {}

function validate(data: { name: string; targetAmount: number }) {
  if (data.name.trim() === '') {
    throw new SavingsGoalValidationError('nameは必須です');
  }
  if (!Number.isInteger(data.targetAmount) || data.targetAmount < 1) {
    throw new SavingsGoalValidationError('targetAmountは1円以上の整数である必要があります');
  }
}

export async function listSavingsGoals(householdId: bigint) {
  return prisma.savingsGoal.findMany({
    where: { householdId, isActive: true },
    orderBy: { id: 'asc' },
  });
}

export interface CreateSavingsGoalInput {
  name: string;
  targetAmount: number;
}

export async function createSavingsGoal(householdId: bigint, data: CreateSavingsGoalInput) {
  validate(data);
  return prisma.savingsGoal.create({
    data: { householdId, name: data.name, targetAmount: data.targetAmount },
  });
}

export interface UpdateSavingsGoalInput {
  name?: string;
  targetAmount?: number;
  isActive?: boolean;
}

export async function updateSavingsGoal(
  householdId: bigint,
  id: bigint,
  data: UpdateSavingsGoalInput
) {
  const existing = await prisma.savingsGoal.findFirst({ where: { id, householdId } });
  if (!existing) {
    throw new SavingsGoalNotFoundError('貯金目標が見つかりません');
  }
  validate({
    name: data.name ?? existing.name,
    targetAmount: data.targetAmount ?? Number(existing.targetAmount),
  });
  const after = await prisma.savingsGoal.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.targetAmount !== undefined ? { targetAmount: data.targetAmount } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });
  return { before: existing, after };
}
