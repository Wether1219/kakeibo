import { prisma } from '../prisma';
import {
  apportionTransactionAmount,
  calculateMonthlySummaryForUser,
  calculateRatios,
} from './summaryLogic';

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

export interface VisualizationBalance {
  income: number;
  preSaving: number;
  expense: number;
  remainingSaving: number;
  totalSaving: number;
}

export interface VisualizationCategoryAmount {
  categoryId: string;
  icon: string | null;
  name: string;
  amount: number;
}

export interface VisualizationMonthlyAverageBalance {
  income: number;
  preSaving: number;
  fixedExpense: number;
  variableExpense: number;
  remainingSaving: number;
  totalSaving: number;
  incomeByCategory: VisualizationCategoryAmount[];
  preSavingByCategory: VisualizationCategoryAmount[];
  fixedExpenseByCategory: VisualizationCategoryAmount[];
  variableExpenseByCategory: VisualizationCategoryAmount[];
}

export interface VisualizationMonthlyRatio {
  month: number;
  expenseRatio: number;
  savingRatio: number;
}

export interface VisualizationMember {
  userId: string;
  displayName: string;
  monthlyAverage: VisualizationMonthlyAverageBalance;
  bonusAverage: number;
  annual: VisualizationBalance;
  expenseRatio: number;
  savingRatio: number;
  monthlyRatios: VisualizationMonthlyRatio[];
}

export interface VisualizationSummary {
  year: number;
  members: VisualizationMember[];
}

const BONUS_CATEGORY_ICON = '💰';
const BONUS_CATEGORY_NAME = '賞与';

export async function getVisualizationSummary(
  householdId: bigint,
  year: number
): Promise<VisualizationSummary> {
  if (!Number.isInteger(year)) {
    throw new SummaryValidationError('yearが不正です');
  }
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const [users, categories, incomes, preSavings, transactions] = await Promise.all([
    prisma.user.findMany({ where: { householdId }, orderBy: { id: 'asc' } }),
    prisma.category.findMany({ where: { householdId } }),
    prisma.income.findMany({ where: { householdId, year } }),
    prisma.preSaving.findMany({ where: { householdId, year } }),
    prisma.transaction.findMany({
      where: {
        householdId,
        transactionDate: { gte: yearStart, lt: yearEnd },
        category: { type: { in: ['fixed_expense', 'variable_expense'] } },
      },
      include: { category: true },
    }),
  ]);

  const bonusCategoryIds = new Set(
    categories
      .filter((c) => c.type === 'income' && c.icon === BONUS_CATEGORY_ICON && c.name === BONUS_CATEGORY_NAME)
      .map((c) => c.id)
  );

  const activeCategories = categories
    .filter((c) => c.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const incomeCategories = activeCategories.filter(
    (c) => c.type === 'income' && !bonusCategoryIds.has(c.id)
  );
  const preSavingCategories = activeCategories.filter((c) => c.type === 'pre_saving');
  const fixedExpenseCategories = activeCategories.filter((c) => c.type === 'fixed_expense');
  const variableExpenseCategories = activeCategories.filter((c) => c.type === 'variable_expense');

  const members: VisualizationMember[] = users.map((user) => {
    const monthlyBalances: VisualizationBalance[] = [];
    const monthlyBreakdowns: {
      income: number;
      preSaving: number;
      fixedExpense: number;
      variableExpense: number;
    }[] = [];
    let bonusAnnualTotal = 0;

    for (let month = 1; month <= 12; month++) {
      const monthIncomes = incomes.filter((i) => i.userId === user.id && i.month === month);
      const bonusAmount = monthIncomes
        .filter((i) => bonusCategoryIds.has(i.categoryId))
        .reduce((sum, i) => sum + Number(i.amount), 0);
      const incomeExclBonus = monthIncomes
        .filter((i) => !bonusCategoryIds.has(i.categoryId))
        .reduce((sum, i) => sum + Number(i.amount), 0);
      bonusAnnualTotal += bonusAmount;

      const preSaving = preSavings
        .filter((p) => p.userId === user.id && p.month === month)
        .reduce((sum, p) => sum + Number(p.actualAmount), 0);
      const monthTransactions = transactions.filter((t) => t.transactionDate.getUTCMonth() + 1 === month);
      const apportion = (t: (typeof monthTransactions)[number]) =>
        apportionTransactionAmount(
          { splitType: t.splitType, userId: t.userId, createdBy: t.createdBy, amount: Number(t.amount) },
          user.id
        );
      const fixedExpense = monthTransactions
        .filter((t) => t.category.type === 'fixed_expense')
        .reduce((sum, t) => sum + apportion(t), 0);
      const variableExpense = monthTransactions
        .filter((t) => t.category.type === 'variable_expense')
        .reduce((sum, t) => sum + apportion(t), 0);
      const expense = fixedExpense + variableExpense;
      const income = incomeExclBonus + bonusAmount;

      const { remainingSaving, totalSaving } = calculateMonthlySummaryForUser({
        income,
        preSaving,
        expense,
      });
      monthlyBalances.push({ income, preSaving, expense, remainingSaving, totalSaving });
      monthlyBreakdowns.push({ income: incomeExclBonus, preSaving, fixedExpense, variableExpense });
    }

    const annual = monthlyBalances.reduce<VisualizationBalance>(
      (sum, m) => ({
        income: sum.income + m.income,
        preSaving: sum.preSaving + m.preSaving,
        expense: sum.expense + m.expense,
        remainingSaving: sum.remainingSaving + m.remainingSaving,
        totalSaving: sum.totalSaving + m.totalSaving,
      }),
      { income: 0, preSaving: 0, expense: 0, remainingSaving: 0, totalSaving: 0 }
    );

    const monthsWithData = monthlyBreakdowns.filter(
      (m) => m.income !== 0 || m.preSaving !== 0 || m.fixedExpense !== 0 || m.variableExpense !== 0
    ).length;

    const annualBreakdown = monthlyBreakdowns.reduce(
      (sum, m) => ({
        income: sum.income + m.income,
        preSaving: sum.preSaving + m.preSaving,
        fixedExpense: sum.fixedExpense + m.fixedExpense,
        variableExpense: sum.variableExpense + m.variableExpense,
      }),
      { income: 0, preSaving: 0, fixedExpense: 0, variableExpense: 0 }
    );

    const monthlyAverageBase =
      monthsWithData === 0
        ? { income: 0, preSaving: 0, fixedExpense: 0, variableExpense: 0 }
        : {
            income: annualBreakdown.income / monthsWithData,
            preSaving: annualBreakdown.preSaving / monthsWithData,
            fixedExpense: annualBreakdown.fixedExpense / monthsWithData,
            variableExpense: annualBreakdown.variableExpense / monthsWithData,
          };
    const { remainingSaving: avgRemainingSaving, totalSaving: avgTotalSaving } =
      calculateMonthlySummaryForUser({
        income: monthlyAverageBase.income,
        preSaving: monthlyAverageBase.preSaving,
        expense: monthlyAverageBase.fixedExpense + monthlyAverageBase.variableExpense,
      });

    const averageByCategory = (
      categoryList: typeof activeCategories,
      annualAmount: (categoryId: bigint) => number
    ): VisualizationCategoryAmount[] =>
      categoryList.map((c) => ({
        categoryId: c.id.toString(),
        icon: c.icon,
        name: c.name,
        amount: monthsWithData === 0 ? 0 : annualAmount(c.id) / monthsWithData,
      }));

    const monthlyAverage: VisualizationMonthlyAverageBalance = {
      ...monthlyAverageBase,
      remainingSaving: avgRemainingSaving,
      totalSaving: avgTotalSaving,
      incomeByCategory: averageByCategory(incomeCategories, (categoryId) =>
        incomes
          .filter((i) => i.userId === user.id && i.categoryId === categoryId)
          .reduce((sum, i) => sum + Number(i.amount), 0)
      ),
      preSavingByCategory: averageByCategory(preSavingCategories, (categoryId) =>
        preSavings
          .filter((p) => p.userId === user.id && p.categoryId === categoryId)
          .reduce((sum, p) => sum + Number(p.actualAmount), 0)
      ),
      fixedExpenseByCategory: averageByCategory(fixedExpenseCategories, (categoryId) =>
        transactions
          .filter((t) => t.categoryId === categoryId)
          .reduce(
            (sum, t) =>
              sum +
              apportionTransactionAmount(
                { splitType: t.splitType, userId: t.userId, createdBy: t.createdBy, amount: Number(t.amount) },
                user.id
              ),
            0
          )
      ),
      variableExpenseByCategory: averageByCategory(variableExpenseCategories, (categoryId) =>
        transactions
          .filter((t) => t.categoryId === categoryId)
          .reduce(
            (sum, t) =>
              sum +
              apportionTransactionAmount(
                { splitType: t.splitType, userId: t.userId, createdBy: t.createdBy, amount: Number(t.amount) },
                user.id
              ),
            0
          )
      ),
    };
    const bonusAverage = bonusAnnualTotal / 2;

    const { expenseRatio, savingRatio } = calculateRatios({
      income: annual.income,
      expense: annual.expense,
      totalSaving: annual.totalSaving,
    });

    const monthlyRatios: VisualizationMonthlyRatio[] = monthlyBalances.map((m, index) => {
      const ratios = calculateRatios({
        income: m.income,
        expense: m.expense,
        totalSaving: m.totalSaving,
      });
      return { month: index + 1, expenseRatio: ratios.expenseRatio, savingRatio: ratios.savingRatio };
    });

    return {
      userId: user.id.toString(),
      displayName: user.displayName,
      monthlyAverage,
      bonusAverage,
      annual,
      expenseRatio,
      savingRatio,
      monthlyRatios,
    };
  });

  return { year, members };
}
