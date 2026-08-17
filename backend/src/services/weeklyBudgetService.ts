import { prisma } from '../prisma';
import {
  apportionTransactionAmount,
  calculateSuggestedMonthlyBudget,
  calculateWeekNumber,
  distributeBudgetAcrossWeeks,
  WeekDayCount,
} from './summaryLogic';

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

function weeklyBudgetKey(i: { year: number; month: number; weekNo: number; categoryId: bigint }) {
  return `${i.year}:${i.month}:${i.weekNo}:${i.categoryId}`;
}

// 監査ログのbefore/after記録のため、upsert前の既存行をまとめて取得し結果と対にして返す
export async function bulkUpsertWeeklyBudgets(householdId: bigint, items: WeeklyBudgetInput[]) {
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
      throw new WeeklyBudgetValidationError('categoryIdが不正です');
    }
    if (category.type !== 'variable_expense') {
      throw new WeeklyBudgetValidationError(
        'categoryIdは変動費費目（type=variable_expense）である必要があります'
      );
    }
  }

  const existingRows =
    items.length === 0
      ? []
      : await prisma.weeklyBudget.findMany({
          where: {
            householdId,
            OR: items.map((item) => ({
              year: item.year,
              month: item.month,
              weekNo: item.weekNo,
              categoryId: item.categoryId,
            })),
          },
        });
  const existingMap = new Map(existingRows.map((row) => [weeklyBudgetKey(row), row]));

  const results = await prisma.$transaction(
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

  return results.map((result, idx) => ({
    result,
    before: existingMap.get(weeklyBudgetKey(items[idx])) ?? null,
  }));
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
  hasBudget: boolean;
  suggestedAmount: number;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function weekDayCountsOfMonth(year: number, month: number): WeekDayCount[] {
  const counts = new Map<number, number>();
  const total = daysInMonth(year, month);
  for (let d = 1; d <= total; d++) {
    const weekNo = calculateWeekNumber(new Date(Date.UTC(year, month - 1, d)));
    counts.set(weekNo, (counts.get(weekNo) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([a], [b]) => a - b)
    .map(([weekNo, days]) => ({ weekNo, days }));
}

// ふるさと納税は年間の寄附上限枠に対する残り枠を管理する性質上、他費目の日次平均による予測ではなく
// 「前年合計－当年（前月まで）使用分」の残り枠をそのまま月初週にまとめて表示する特別扱いとする。
const FURUSATO_NOZEI_CATEGORY_NAME = 'ふるさと納税';

function householdTotal(
  transactions: { splitType: 'self' | 'shared'; userId: bigint | null; createdBy: bigint; amount: unknown }[],
  users: { id: bigint }[]
): number {
  return transactions.reduce(
    (sum, tx) =>
      sum +
      users.reduce(
        (s, user) =>
          s +
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
      ),
    0
  );
}

// ふるさと納税の残り枠＝前年（1〜12月）の世帯合計実績－当年（1月〜前月まで）の世帯合計実績（マイナスにはしない）
async function calculateFurusatoNozeiRemainingBudget(
  householdId: bigint,
  categoryId: bigint,
  year: number,
  month: number,
  users: { id: bigint }[]
): Promise<number> {
  const prevYearStart = new Date(Date.UTC(year - 1, 0, 1));
  const prevYearEnd = new Date(Date.UTC(year, 0, 1));
  const usedThisYearEnd = new Date(Date.UTC(year, month - 1, 1));

  const [prevYearTransactions, usedThisYearTransactions] = await Promise.all([
    prisma.transaction.findMany({
      where: { householdId, categoryId, transactionDate: { gte: prevYearStart, lt: prevYearEnd } },
    }),
    prisma.transaction.findMany({
      where: {
        householdId,
        categoryId,
        transactionDate: { gte: prevYearEnd, lt: usedThisYearEnd },
      },
    }),
  ]);

  const previousYearTotal = householdTotal(prevYearTransactions, users);
  const usedThisYear = householdTotal(usedThisYearTransactions, users);
  return Math.max(previousYearTotal - usedThisYear, 0);
}

// 週次予算の自動入力：その年の1月〜前月までの世帯合計実績から月合計予算を算出し、各週へ日数比で配分する。
// 1月は年内に前月データが存在しないため、直近12ヶ月（＝前年1月〜前年12月の1年間）を参照する。
async function calculateSuggestedBudgets(
  householdId: bigint,
  year: number,
  month: number,
  categories: { id: bigint; name: string }[]
): Promise<Map<string, number>> {
  const suggestionMap = new Map<string, number>();

  const cumStart =
    month === 1 ? new Date(Date.UTC(year - 1, 0, 1)) : new Date(Date.UTC(year, 0, 1));
  const cumEnd = month === 1 ? new Date(Date.UTC(year, 0, 1)) : new Date(Date.UTC(year, month - 1, 1));
  const daysElapsed = Math.round((cumEnd.getTime() - cumStart.getTime()) / (24 * 60 * 60 * 1000));

  const [users, cumulativeTransactions] = await Promise.all([
    prisma.user.findMany({ where: { householdId } }),
    prisma.transaction.findMany({
      where: {
        householdId,
        transactionDate: { gte: cumStart, lt: cumEnd },
        category: { type: 'variable_expense' },
      },
    }),
  ]);

  const furusatoCategory = categories.find((c) => c.name === FURUSATO_NOZEI_CATEGORY_NAME);
  const furusatoCategoryId = furusatoCategory?.id.toString();

  const cumulativeTotalByCategory = new Map<string, number>();
  for (const tx of cumulativeTransactions) {
    const key = tx.categoryId.toString();
    if (key === furusatoCategoryId) continue;
    const householdAmount = householdTotal([tx], users);
    cumulativeTotalByCategory.set(key, (cumulativeTotalByCategory.get(key) ?? 0) + householdAmount);
  }

  const weekDayCounts = weekDayCountsOfMonth(year, month);
  const currentDaysInMonth = daysInMonth(year, month);

  for (const [categoryId, cumulativeTotal] of cumulativeTotalByCategory) {
    const monthlyBudget = calculateSuggestedMonthlyBudget(
      cumulativeTotal,
      daysElapsed,
      currentDaysInMonth
    );
    const distribution = distributeBudgetAcrossWeeks(monthlyBudget, weekDayCounts);
    for (const { weekNo, amount } of distribution) {
      suggestionMap.set(`${weekNo}:${categoryId}`, amount);
    }
  }

  if (furusatoCategory) {
    const remaining = await calculateFurusatoNozeiRemainingBudget(
      householdId,
      furusatoCategory.id,
      year,
      month,
      users
    );
    const firstWeekNo = weekDayCounts[0]?.weekNo ?? 1;
    suggestionMap.set(`${firstWeekNo}:${furusatoCategoryId}`, remaining);
  }

  return suggestionMap;
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

  const categories = await prisma.category.findMany({
    where: { householdId, type: 'variable_expense', isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  const [budgets, users, transactions, suggestionMap] = await Promise.all([
    prisma.weeklyBudget.findMany({ where: { householdId, year, month } }),
    prisma.user.findMany({ where: { householdId } }),
    prisma.transaction.findMany({
      where: {
        householdId,
        transactionDate: { gte: start, lt: end },
        category: { type: 'variable_expense' },
      },
    }),
    calculateSuggestedBudgets(householdId, year, month, categories),
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
    const key = `${b.weekNo}:${b.categoryId}`;
    budgetMap.set(key, Number(b.budgetAmount));
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
        // DBに行があっても金額が0円のセルは「未入力」として扱う（過去の一括保存で全セルに0円が保存されるため、
        // 行の有無だけでは実際に入力済みかを判定できない）
        hasBudget: budgetAmount > 0,
        suggestedAmount: suggestionMap.get(key) ?? 0,
      });
    }
  }
  return rows;
}
