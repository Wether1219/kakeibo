import { prisma } from '../prisma';
import { apportionTransactionAmount, calculateWeekNumber } from './summaryLogic';

export class WeeklyBudgetValidationError extends Error {}

export interface WeeklyBudgetInput {
  year: number;
  month: number;
  weekNo: number;
  categoryId: bigint;
  budgetAmount: number;
}

// calculateWeekNumberは月末が日曜日の場合に第6週を返しうるため（summaryLogic.test.ts参照）、
// 設計書1.7節のTINYINTコメント「1〜5」は型の説明であり上限としては扱わない。
function validateInput(data: WeeklyBudgetInput) {
  if (!Number.isInteger(data.year) || data.year < 2000 || data.year > 2100) {
    throw new WeeklyBudgetValidationError('yearが不正です');
  }
  if (!Number.isInteger(data.month) || data.month < 1 || data.month > 12) {
    throw new WeeklyBudgetValidationError('monthは1〜12の整数である必要があります');
  }
  if (!Number.isInteger(data.weekNo) || data.weekNo < 1 || data.weekNo > 6) {
    throw new WeeklyBudgetValidationError('weekNoは1〜6の整数である必要があります');
  }
  if (!Number.isInteger(data.budgetAmount) || data.budgetAmount < 0) {
    throw new WeeklyBudgetValidationError('budgetAmountは0以上の整数である必要があります');
  }
}

async function assertVariableExpenseCategory(householdId: bigint, categoryId: bigint) {
  const category = await prisma.category.findFirst({ where: { id: categoryId, householdId } });
  if (!category) {
    throw new WeeklyBudgetValidationError('categoryIdが不正です');
  }
  if (category.type !== 'variable_expense') {
    throw new WeeklyBudgetValidationError(
      'categoryIdは変動費費目（type=variable_expense）である必要があります'
    );
  }
}

export async function bulkUpsertWeeklyBudgets(householdId: bigint, items: WeeklyBudgetInput[]) {
  items.forEach(validateInput);
  for (const item of items) {
    await assertVariableExpenseCategory(householdId, item.categoryId);
  }
  return prisma.$transaction(
    items.map((item) =>
      prisma.weeklyBudget.upsert({
        where: {
          householdId_year_month_weekNo_categoryId: {
            householdId,
            year: item.year,
            month: item.month,
            weekNo: item.weekNo,
            categoryId: item.categoryId,
          },
        },
        update: { budgetAmount: item.budgetAmount },
        create: {
          householdId,
          year: item.year,
          month: item.month,
          weekNo: item.weekNo,
          categoryId: item.categoryId,
          budgetAmount: item.budgetAmount,
        },
      })
    )
  );
}

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

export interface WeeklyBudgetWithActual {
  weekNo: number;
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  budgetAmount: number;
  actualAmount: number;
  diff: number;
}

export async function listWeeklyBudgetsWithActual(
  householdId: bigint,
  year: number,
  month: number
): Promise<WeeklyBudgetWithActual[]> {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new WeeklyBudgetValidationError('year・monthが不正です');
  }
  const { start, end } = monthRange(year, month);

  const [budgets, categories, users, transactions] = await Promise.all([
    prisma.weeklyBudget.findMany({ where: { householdId, year, month } }),
    prisma.category.findMany({
      where: { householdId, type: 'variable_expense', isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.user.findMany({ where: { householdId } }),
    prisma.transaction.findMany({
      where: {
        householdId,
        transactionDate: { gte: start, lt: end },
        category: { type: 'variable_expense' },
      },
    }),
  ]);

  // 週×費目ごとの実績を5.1按分ロジックで算出。世帯内の全ユーザー分を合算することで世帯合計になる。
  const actualMap = new Map<string, number>();
  for (const tx of transactions) {
    const weekNo = calculateWeekNumber(tx.transactionDate);
    const key = `${weekNo}:${tx.categoryId}`;
    const householdAmount = users.reduce(
      (sum, user) =>
        sum +
        apportionTransactionAmount(
          {
            splitType: tx.splitType,
            userId: tx.userId,
            createdBy: tx.createdBy,
            amount: Number(tx.amount),
          },
          user.id
        ),
      0
    );
    actualMap.set(key, (actualMap.get(key) ?? 0) + householdAmount);
  }

  const budgetMap = new Map<string, number>();
  for (const b of budgets) {
    budgetMap.set(`${b.weekNo}:${b.categoryId}`, Number(b.budgetAmount));
  }

  // SC06「月の日数に応じ自動表示切替」に対応するため、月末を含む週まではデータの有無に関わらず表示対象とする。
  const lastDayWeekNo = calculateWeekNumber(new Date(Date.UTC(year, month, 0)));
  const weekNumbers = new Set<number>();
  for (let w = 1; w <= lastDayWeekNo; w++) weekNumbers.add(w);
  for (const b of budgets) weekNumbers.add(b.weekNo);
  for (const key of actualMap.keys()) weekNumbers.add(Number(key.split(':')[0]));

  const rows: WeeklyBudgetWithActual[] = [];
  for (const weekNo of Array.from(weekNumbers).sort((a, b) => a - b)) {
    for (const category of categories) {
      const key = `${weekNo}:${category.id}`;
      const budgetAmount = budgetMap.get(key) ?? 0;
      const actualAmount = actualMap.get(key) ?? 0;
      rows.push({
        weekNo,
        categoryId: category.id.toString(),
        categoryName: category.name,
        categoryIcon: category.icon,
        budgetAmount,
        actualAmount,
        diff: budgetAmount - actualAmount,
      });
    }
  }
  return rows;
}
