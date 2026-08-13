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
