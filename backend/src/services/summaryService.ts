import { prisma } from '../prisma';
import { apportionTransactionAmount, calculateMonthlySummaryForUser } from './summaryLogic';

export class SummaryValidationError extends Error {}

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

export interface MonthlySummaryMember {
  userId: string;
  displayName: string;
  income: number;
  preSaving: number;
  fixedExpense: number;
  variableExpense: number;
  expense: number;
  remainingSaving: number;
  totalSaving: number;
}

export interface MonthlySummaryCategoryRow {
  category: string;
  [displayName: string]: string | number;
}

export interface MonthlySummary {
  year: number;
  month: number;
  members: MonthlySummaryMember[];
  fixedExpenseByCategory: MonthlySummaryCategoryRow[];
  variableExpenseByCategory: MonthlySummaryCategoryRow[];
}

export async function getMonthlySummary(
  householdId: bigint,
  year: number,
  month: number
): Promise<MonthlySummary> {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new SummaryValidationError('year・monthが不正です');
  }
  const { start, end } = monthRange(year, month);

  const [users, transactions, incomes, preSavings] = await Promise.all([
    prisma.user.findMany({ where: { householdId }, orderBy: { id: 'asc' } }),
    prisma.transaction.findMany({
      where: {
        householdId,
        transactionDate: { gte: start, lt: end },
        category: { type: { in: ['fixed_expense', 'variable_expense'] } },
      },
      include: { category: true },
    }),
    prisma.income.findMany({ where: { householdId, year, month } }),
    prisma.preSaving.findMany({ where: { householdId, year, month } }),
  ]);

  const categories = await prisma.category.findMany({
    where: { householdId, type: { in: ['fixed_expense', 'variable_expense'] }, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  const members: MonthlySummaryMember[] = users.map((user) => {
    const income = incomes
      .filter((i) => i.userId === user.id)
      .reduce((sum, i) => sum + Number(i.amount), 0);
    const preSaving = preSavings
      .filter((p) => p.userId === user.id)
      .reduce((sum, p) => sum + Number(p.actualAmount), 0);
    const fixedExpense = transactions
      .filter((t) => t.category.type === 'fixed_expense')
      .reduce(
        (sum, t) =>
          sum +
          apportionTransactionAmount(
            { splitType: t.splitType, userId: t.userId, createdBy: t.createdBy, amount: Number(t.amount) },
            user.id
          ),
        0
      );
    const variableExpense = transactions
      .filter((t) => t.category.type === 'variable_expense')
      .reduce(
        (sum, t) =>
          sum +
          apportionTransactionAmount(
            { splitType: t.splitType, userId: t.userId, createdBy: t.createdBy, amount: Number(t.amount) },
            user.id
          ),
        0
      );
    const expense = fixedExpense + variableExpense;
    const { remainingSaving, totalSaving } = calculateMonthlySummaryForUser({
      income,
      preSaving,
      expense,
    });

    return {
      userId: user.id.toString(),
      displayName: user.displayName,
      income,
      preSaving,
      fixedExpense,
      variableExpense,
      expense,
      remainingSaving,
      totalSaving,
    };
  });

  function categoryBreakdown(type: 'fixed_expense' | 'variable_expense'): MonthlySummaryCategoryRow[] {
    return categories
      .filter((c) => c.type === type)
      .map((category) => {
        const categoryTransactions = transactions.filter((t) => t.categoryId === category.id);
        const row: MonthlySummaryCategoryRow = {
          category: `${category.icon ?? ''}${category.name}`,
        };
        for (const user of users) {
          row[user.displayName] = categoryTransactions.reduce(
            (sum, t) =>
              sum +
              apportionTransactionAmount(
                { splitType: t.splitType, userId: t.userId, createdBy: t.createdBy, amount: Number(t.amount) },
                user.id
              ),
            0
          );
        }
        return row;
      });
  }

  return {
    year,
    month,
    members,
    fixedExpenseByCategory: categoryBreakdown('fixed_expense'),
    variableExpenseByCategory: categoryBreakdown('variable_expense'),
  };
}
