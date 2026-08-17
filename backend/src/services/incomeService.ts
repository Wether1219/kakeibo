import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';

export class IncomeValidationError extends Error {}

export interface IncomeInput {
  year: number;
  month: number;
  userId: bigint;
  categoryId: bigint;
  amount: number;
}

function validateInput(data: IncomeInput) {
  if (!Number.isInteger(data.year) || data.year < 2000 || data.year > 2100) {
    throw new IncomeValidationError('yearが不正です');
  }
  if (!Number.isInteger(data.month) || data.month < 1 || data.month > 12) {
    throw new IncomeValidationError('monthは1〜12の整数である必要があります');
  }
  if (!Number.isInteger(data.amount) || data.amount < 0) {
    throw new IncomeValidationError('amountは0以上の整数である必要があります');
  }
}

export async function listIncomes(
  householdId: bigint,
  filter: { year?: number; month?: number }
) {
  const where: Prisma.IncomeWhereInput = { householdId };
  if (filter.year !== undefined) {
    where.year = filter.year;
  }
  if (filter.month !== undefined) {
    where.month = filter.month;
  }
  return prisma.income.findMany({
    where,
    orderBy: [{ year: 'asc' }, { month: 'asc' }, { userId: 'asc' }, { categoryId: 'asc' }],
  });
}

function incomeKey(i: { year: number; month: number; userId: bigint; categoryId: bigint }) {
  return `${i.year}:${i.month}:${i.userId}:${i.categoryId}`;
}

// 監査ログのbefore/after記録のため、upsert前の既存行をまとめて取得し結果と対にして返す
export async function bulkUpsertIncomes(householdId: bigint, items: IncomeInput[]) {
  items.forEach(validateInput);

  const categoryIds = Array.from(new Set(items.map((item) => item.categoryId)));
  const categories =
    categoryIds.length === 0
      ? []
      : await prisma.category.findMany({ where: { id: { in: categoryIds }, householdId } });
  const categoryMap = new Map(categories.map((c) => [c.id.toString(), c]));
  for (const item of items) {
    const category = categoryMap.get(item.categoryId.toString());
    if (!category) {
      throw new IncomeValidationError('categoryIdが不正です');
    }
    if (category.type !== 'income') {
      throw new IncomeValidationError('categoryIdは収入費目（type=income）である必要があります');
    }
  }

  const existingRows =
    items.length === 0
      ? []
      : await prisma.income.findMany({
          where: {
            householdId,
            OR: items.map((item) => ({
              year: item.year,
              month: item.month,
              userId: item.userId,
              categoryId: item.categoryId,
            })),
          },
        });
  const existingMap = new Map(existingRows.map((row) => [incomeKey(row), row]));

  const results = await prisma.$transaction(
    items.map((item) =>
      prisma.income.upsert({
        where: {
          householdId_year_month_userId_categoryId: {
            householdId,
            year: item.year,
            month: item.month,
            userId: item.userId,
            categoryId: item.categoryId,
          },
        },
        update: { amount: item.amount },
        create: {
          householdId,
          year: item.year,
          month: item.month,
          userId: item.userId,
          categoryId: item.categoryId,
          amount: item.amount,
        },
      })
    )
  );

  return results.map((result, idx) => ({
    result,
    before: existingMap.get(incomeKey(items[idx])) ?? null,
  }));
}
