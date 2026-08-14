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
  categoryId: string;
  icon: string | null;
  name: string;
  amounts: Record<string, number>;
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
        const amounts: Record<string, number> = {};
        for (const user of users) {
          amounts[user.id.toString()] = categoryTransactions.reduce(
            (sum, t) =>
              sum +
              apportionTransactionAmount(
                { splitType: t.splitType, userId: t.userId, createdBy: t.createdBy, amount: Number(t.amount) },
                user.id
              ),
            0
          );
        }
        return {
          categoryId: category.id.toString(),
          icon: category.icon,
          name: category.name,
          amounts,
        };
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

export interface AnnualSummaryRow {
  categoryType: 'income' | 'pre_saving' | 'fixed_expense' | 'variable_expense';
  categoryName: string;
  userId: string;
  displayName: string;
  months: number[];
  annualTotal: number;
}

export interface AnnualSummary {
  year: number;
  rows: AnnualSummaryRow[];
}

export async function getAnnualSummary(householdId: bigint, year: number): Promise<AnnualSummary> {
  if (!Number.isInteger(year)) {
    throw new SummaryValidationError('yearが不正です');
  }
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const [users, categories, incomes, preSavings, transactions] = await Promise.all([
    prisma.user.findMany({ where: { householdId }, orderBy: { id: 'asc' } }),
    prisma.category.findMany({
      where: { householdId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.income.findMany({ where: { householdId, year } }),
    prisma.preSaving.findMany({ where: { householdId, year } }),
    prisma.transaction.findMany({
      where: {
        householdId,
        transactionDate: { gte: yearStart, lt: yearEnd },
        category: { type: { in: ['fixed_expense', 'variable_expense'] } },
      },
    }),
  ]);

  const rows: AnnualSummaryRow[] = [];

  for (const category of categories) {
    for (const user of users) {
      const months = new Array(12).fill(0);

      if (category.type === 'income') {
        for (const income of incomes) {
          if (income.categoryId === category.id && income.userId === user.id) {
            months[income.month - 1] += Number(income.amount);
          }
        }
      } else if (category.type === 'pre_saving') {
        for (const preSaving of preSavings) {
          if (preSaving.categoryId === category.id && preSaving.userId === user.id) {
            months[preSaving.month - 1] += Number(preSaving.actualAmount);
          }
        }
      } else {
        for (const t of transactions) {
          if (t.categoryId !== category.id) continue;
          const monthIndex = t.transactionDate.getUTCMonth();
          months[monthIndex] += apportionTransactionAmount(
            { splitType: t.splitType, userId: t.userId, createdBy: t.createdBy, amount: Number(t.amount) },
            user.id
          );
        }
      }

      rows.push({
        categoryType: category.type,
        categoryName: `${category.icon ?? ''}${category.name}`,
        userId: user.id.toString(),
        displayName: user.displayName,
        months,
        annualTotal: months.reduce((sum, m) => sum + m, 0),
      });
    }
  }

  return { year, rows };
}
