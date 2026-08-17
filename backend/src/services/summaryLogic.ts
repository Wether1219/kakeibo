// docs/03_詳細設計書.md 5章「集計ロジック詳細」のアプリロジック化。
// DB非依存の純粋関数として実装し、単体テストで境界値（端数・0件・分母0）を検証する。

export interface ApportionableTransaction {
  splitType: 'self' | 'shared';
  userId: bigint | null;
  createdBy: bigint;
  amount: number;
}

/**
 * 5.1節：「両方（折半）」の按分ロジック。
 * sharedの端数（奇数円）はFLOOR(amount/2)で切り捨てた分、入力者（createdBy）側に1円加算する。
 */
export function apportionTransactionAmount(
  tx: ApportionableTransaction,
  targetUserId: bigint
): number {
  if (tx.splitType === 'self') {
    return tx.userId === targetUserId ? tx.amount : 0;
  }
  const half = Math.floor(tx.amount / 2);
  const remainder = tx.amount - half * 2;
  if (tx.createdBy === targetUserId) {
    return half + remainder;
  }
  return half;
}

/**
 * 5.2節：週番号の算出ロジック。月初日を含む週を日曜始まりで第1週とする。
 */
export function calculateWeekNumber(date: Date): number {
  const firstDayOfMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const firstSunday = new Date(firstDayOfMonth);
  firstSunday.setUTCDate(firstDayOfMonth.getUTCDate() - firstDayOfMonth.getUTCDay());
  const diffDays = Math.floor((date.getTime() - firstSunday.getTime()) / (24 * 60 * 60 * 1000));
  return Math.floor(diffDays / 7) + 1;
}

export interface MonthlySummaryInput {
  income: number;
  preSaving: number;
  expense: number;
}

export interface MonthlySummaryResult {
  remainingSaving: number;
  totalSaving: number;
}

/**
 * 5.3節：当月収支サマリ。
 * remainingSaving(d) = income(a) - preSaving(b) - expense(c)
 * totalSaving(e)      = preSaving(b) + remainingSaving(d)
 */
export function calculateMonthlySummaryForUser(
  input: MonthlySummaryInput
): MonthlySummaryResult {
  const remainingSaving = input.income - input.preSaving - input.expense;
  const totalSaving = input.preSaving + remainingSaving;
  return { remainingSaving, totalSaving };
}

export interface RatioInput {
  income: number;
  expense: number;
  totalSaving: number;
}

export interface RatioResult {
  expenseRatio: number;
  savingRatio: number;
}

/**
 * 5.4節：比率計算（ゼロ除算ガード）。現行Excelの IFERROR(...,0) に相当。
 */
export function calculateRatios(input: RatioInput): RatioResult {
  if (input.income === 0) {
    return { expenseRatio: 0, savingRatio: 0 };
  }
  return {
    expenseRatio: (input.expense / input.income) * 100,
    savingRatio: (input.totalSaving / input.income) * 100,
  };
}

/**
 * 週次予算の自動入力：月合計予算の算出。
 * その年の1月〜前月までの世帯合計実績を前月までの経過日数で割った日次平均に、
 * 当該月の日数を掛けて月合計予算とする。daysElapsed<=0（1月など前月データが無い月）は0とする。
 */
export function calculateSuggestedMonthlyBudget(
  cumulativeActualTotal: number,
  daysElapsed: number,
  daysInMonth: number
): number {
  if (daysElapsed <= 0) {
    return 0;
  }
  return Math.round((cumulativeActualTotal / daysElapsed) * daysInMonth);
}

export interface WeekDayCount {
  weekNo: number;
  days: number;
}

export interface WeeklyBudgetDistribution {
  weekNo: number;
  amount: number;
}

/**
 * 週次予算の自動入力：月合計予算を各週の日数比で配分する。
 * 日数比の切り捨て後の端数は最終週（weekDayCountsの末尾）に加算し、合計がmonthlyBudgetと一致するようにする。
 */
export function distributeBudgetAcrossWeeks(
  monthlyBudget: number,
  weekDayCounts: WeekDayCount[]
): WeeklyBudgetDistribution[] {
  const totalDays = weekDayCounts.reduce((sum, w) => sum + w.days, 0);
  if (totalDays === 0) {
    return weekDayCounts.map((w) => ({ weekNo: w.weekNo, amount: 0 }));
  }
  const flooredAmounts = weekDayCounts.map((w) => Math.floor((monthlyBudget * w.days) / totalDays));
  const flooredSum = flooredAmounts.reduce((sum, a) => sum + a, 0);
  const remainder = monthlyBudget - flooredSum;
  const result = weekDayCounts.map((w, i) => ({ weekNo: w.weekNo, amount: flooredAmounts[i] }));
  if (result.length > 0) {
    result[result.length - 1].amount += remainder;
  }
  return result;
}
