import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';

export class PreSavingValidationError extends Error {}

export interface PreSavingInput {
  year: number;
  month: number;
  userId: bigint;
  categoryId: bigint;
  budgetAmount: number;
  actualAmount: number;
}

function validateInput(data: PreSavingInput) {
  if (!Number.isInteger(data.year) || data.year < 2000 || data.year > 2100) {
    throw new PreSavingValidationError('yearが不正です');
  }
  if (!Number.isInteger(data.month) || data.month < 1 || data.month > 12) {
    throw new PreSavingValidationError('monthは1〜12の整数である必要があります');
  }
  if (!Number.isInteger(data.budgetAmount) || data.budgetAmount < 0) {
    throw new PreSavingValidationError('budgetAmountは0以上の整数である必要があります');
  }
  if (!Number.isInteger(data.actualAmount) || data.actualAmount < 0) {
    throw new PreSavingValidationError('actualAmountは0以上の整数である必要があります');
  }
}

async function assertPreSavingCategory(householdId: bigint, categoryId: bigint) {
  const category = await prisma.category.findFirst({ where: { id: categoryId, householdId } });
  if (!category) {
    throw new PreSavingValidationError('categoryIdが不正です');
  }
  if (category.type !== 'pre_saving') {
    throw new PreSavingValidationError('categoryIdは先取り貯金費目（type=pre_saving）である必要があります');
  }
}

export async function listPreSavings(
  householdId: bigint,
  filter: { year?: number; month?: number }
) {
  const where: Prisma.PreSavingWhereInput = { householdId };
  if (filter.year !== undefined) {
    where.year = filter.year;
  }
  if (filter.month !== undefined) {
    where.month = filter.month;
  }
  return prisma.preSaving.findMany({
    where,
    orderBy: [{ year: 'asc' }, { month: 'asc' }, { userId: 'asc' }, { categoryId: 'asc' }],
  });
}

export async function bulkUpsertPreSavings(householdId: bigint, items: PreSavingInput[]) {
  items.forEach(validateInput);
  for (const item of items) {
    await assertPreSavingCategory(householdId, item.categoryId);
  }
  return prisma.$transaction(
    items.map((item) =>
      prisma.preSaving.upsert({
        where: {
          householdId_year_month_userId_categoryId: {
            householdId,
            year: item.year,
            month: item.month,
            userId: item.userId,
            categoryId: item.categoryId,
          },
        },
        update: { budgetAmount: item.budgetAmount, actualAmount: item.actualAmount },
        create: {
          householdId,
          year: item.year,
          month: item.month,
          userId: item.userId,
          categoryId: item.categoryId,
          budgetAmount: item.budgetAmount,
          actualAmount: item.actualAmount,
        },
      })
    )
  );
}
