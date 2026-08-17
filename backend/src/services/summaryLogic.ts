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

export interface SettlementTransaction {
  splitType: 'self' | 'shared';
  userId: bigint | null;
  createdBy: bigint;
  amount: number;
  otherPaidAmount: number | null;
}

export interface SettlementBreakdownRow {
  userId: bigint;
  sharedPaidTotal: number;
  sharedOtherPaidTotal: number;
  paidForOtherTotal: number;
  paidForOtherOtherPaidTotal: number;
}

export interface SettlementResult {
  breakdown: [SettlementBreakdownRow, SettlementBreakdownRow];
  netAmount: number;
  payerIndex: 0 | 1 | null;
}

/**
 * 割り勘・立て替え精算額の算出（2人固定）。
 * 各取引の貸し due(t) = (shared: amount/2, self(相手向け): amount) - (otherPaidAmount ?? 0) を、
 * 支払者(createdBy)がmemberIds[0]なら+、memberIds[1]なら-として合算し、最後に1回だけ丸める。
 * 加算とamount/2は順序を交換しても結果が変わらないため、取引ごとのfloor処理（apportionTransactionAmount）は行わない。
 * splitType='self'かつuserId===createdBy（完全に自分用の支出）は精算対象外。
 */
export function calculateSettlement(
  transactions: SettlementTransaction[],
  memberIds: readonly [bigint, bigint]
): SettlementResult {
  const breakdown: [SettlementBreakdownRow, SettlementBreakdownRow] = [
    {
      userId: memberIds[0],
      sharedPaidTotal: 0,
      sharedOtherPaidTotal: 0,
      paidForOtherTotal: 0,
      paidForOtherOtherPaidTotal: 0,
    },
    {
      userId: memberIds[1],
      sharedPaidTotal: 0,
      sharedOtherPaidTotal: 0,
      paidForOtherTotal: 0,
      paidForOtherOtherPaidTotal: 0,
    },
  ];

  let rawNet = 0;

  for (const tx of transactions) {
    if (tx.splitType === 'self' && tx.userId === tx.createdBy) {
      continue;
    }
    const payerIndex = memberIds.indexOf(tx.createdBy);
    if (payerIndex !== 0 && payerIndex !== 1) {
      continue;
    }
    const otherPaid = tx.otherPaidAmount ?? 0;
    const baseAmount = tx.splitType === 'shared' ? tx.amount / 2 : tx.amount;
    const due = baseAmount - otherPaid;

    const row = breakdown[payerIndex];
    if (tx.splitType === 'shared') {
      row.sharedPaidTotal += tx.amount;
      row.sharedOtherPaidTotal += otherPaid;
    } else {
      row.paidForOtherTotal += tx.amount;
      row.paidForOtherOtherPaidTotal += otherPaid;
    }

    rawNet += payerIndex === 0 ? due : -due;
  }

  // 対称丸め：Math.round単体だと負数の.5が0側に丸められ、支払者の入れ替えだけで金額が変わってしまうため。
  const roundedNet = Math.sign(rawNet) * Math.round(Math.abs(rawNet));
  const payerIndex: 0 | 1 | null = roundedNet === 0 ? null : roundedNet > 0 ? 1 : 0;

  return { breakdown, netAmount: Math.abs(roundedNet), payerIndex };
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
