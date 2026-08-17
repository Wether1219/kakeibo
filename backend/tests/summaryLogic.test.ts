import { describe, expect, it } from 'vitest';
import {
  ApportionableTransaction,
  apportionTransactionAmount,
  calculateMonthlySummaryForUser,
  calculateRatios,
  calculateSuggestedMonthlyBudget,
  calculateWeekNumber,
  distributeBudgetAcrossWeeks,
} from '../src/services/summaryLogic';

const USER_A = 1n;
const USER_B = 2n;

describe('apportionTransactionAmount（5.1 按分ロジック）', () => {
  it('self：本人分のみ計上される', () => {
    const tx: ApportionableTransaction = {
      splitType: 'self',
      userId: USER_A,
      createdBy: USER_A,
      amount: 1000,
    };
    expect(apportionTransactionAmount(tx, USER_A)).toBe(1000);
    expect(apportionTransactionAmount(tx, USER_B)).toBe(0);
  });

  it('shared：偶数円は均等に折半される', () => {
    const tx: ApportionableTransaction = {
      splitType: 'shared',
      userId: null,
      createdBy: USER_A,
      amount: 1000,
    };
    expect(apportionTransactionAmount(tx, USER_A)).toBe(500);
    expect(apportionTransactionAmount(tx, USER_B)).toBe(500);
  });

  it('shared：奇数円の端数（1円）は入力者(createdBy)側に加算される', () => {
    const tx: ApportionableTransaction = {
      splitType: 'shared',
      userId: null,
      createdBy: USER_A,
      amount: 999,
    };
    expect(apportionTransactionAmount(tx, USER_A)).toBe(500); // floor(999/2)=499 + 端数1円
    expect(apportionTransactionAmount(tx, USER_B)).toBe(499);

    // 入力者が逆の場合、端数の加算先も逆になる
    const txByB: ApportionableTransaction = { ...tx, createdBy: USER_B };
    expect(apportionTransactionAmount(txByB, USER_A)).toBe(499);
    expect(apportionTransactionAmount(txByB, USER_B)).toBe(500);
  });

  it('0件（空配列の合算）は0になる', () => {
    const transactions: ApportionableTransaction[] = [];
    const total = transactions.reduce(
      (sum, tx) => sum + apportionTransactionAmount(tx, USER_A),
      0
    );
    expect(total).toBe(0);
  });

  it('shared：1円は端数のみで入力者が全額計上、相手は0円', () => {
    const tx: ApportionableTransaction = {
      splitType: 'shared',
      userId: null,
      createdBy: USER_A,
      amount: 1,
    };
    expect(apportionTransactionAmount(tx, USER_A)).toBe(1);
    expect(apportionTransactionAmount(tx, USER_B)).toBe(0);
  });
});

describe('calculateWeekNumber（5.2 週番号算出ロジック）', () => {
  it('月初が日曜日の場合、月初日は第1週になる（2024-09-01は日曜日）', () => {
    expect(calculateWeekNumber(new Date(Date.UTC(2024, 8, 1)))).toBe(1);
    expect(calculateWeekNumber(new Date(Date.UTC(2024, 8, 7)))).toBe(1); // 土曜（第1週最終日）
    expect(calculateWeekNumber(new Date(Date.UTC(2024, 8, 8)))).toBe(2); // 翌日曜は第2週
  });

  it('月初が金曜日の場合、第1週は短縮される（2024-03-01は金曜日）', () => {
    expect(calculateWeekNumber(new Date(Date.UTC(2024, 2, 1)))).toBe(1); // 金
    expect(calculateWeekNumber(new Date(Date.UTC(2024, 2, 2)))).toBe(1); // 土（第1週最終日）
    expect(calculateWeekNumber(new Date(Date.UTC(2024, 2, 3)))).toBe(2); // 日（第2週開始）
  });

  it('月末日（2024-03-31は日曜日）は第6週になる境界値', () => {
    expect(calculateWeekNumber(new Date(Date.UTC(2024, 2, 31)))).toBe(6);
  });
});

describe('calculateMonthlySummaryForUser（5.3 当月収支サマリ）', () => {
  it('通常値：income - preSaving - expense = remainingSaving、preSaving + remainingSaving = totalSaving', () => {
    const result = calculateMonthlySummaryForUser({
      income: 300000,
      preSaving: 50000,
      expense: 140000,
    });
    expect(result.remainingSaving).toBe(110000);
    expect(result.totalSaving).toBe(160000);
  });

  it('0件（収入・貯金・支出すべて0）は全て0になる', () => {
    const result = calculateMonthlySummaryForUser({ income: 0, preSaving: 0, expense: 0 });
    expect(result.remainingSaving).toBe(0);
    expect(result.totalSaving).toBe(0);
  });

  it('支出が収入を上回る場合、remainingSavingは負の値になる', () => {
    const result = calculateMonthlySummaryForUser({
      income: 100000,
      preSaving: 0,
      expense: 150000,
    });
    expect(result.remainingSaving).toBe(-50000);
    expect(result.totalSaving).toBe(-50000);
  });
});

describe('calculateRatios（5.4 比率計算・ゼロ除算ガード）', () => {
  it('収入が0の場合は両方0になる（ゼロ除算ガード）', () => {
    const result = calculateRatios({ income: 0, expense: 50000, totalSaving: 10000 });
    expect(result.expenseRatio).toBe(0);
    expect(result.savingRatio).toBe(0);
  });

  it('通常値：支出率・貯蓄率が正しく計算される', () => {
    const result = calculateRatios({ income: 200000, expense: 120000, totalSaving: 80000 });
    expect(result.expenseRatio).toBe(60);
    expect(result.savingRatio).toBe(40);
  });
});

describe('calculateSuggestedMonthlyBudget（週次予算の自動入力：月合計予算算出）', () => {
  it('前月までの日次平均×当該月の日数で算出される', () => {
    // 1月〜2月末（59日）で合計29500円 → 日次平均500円 × 3月31日 = 15500円
    expect(calculateSuggestedMonthlyBudget(29500, 59, 31)).toBe(15500);
  });

  it('daysElapsedが0以下の場合は0を返す（1月など前月データが無い場合）', () => {
    expect(calculateSuggestedMonthlyBudget(10000, 0, 31)).toBe(0);
  });

  it('割り切れない場合は四捨五入する', () => {
    // 日次平均333.33... × 30 = 9999.99... → 10000円
    expect(calculateSuggestedMonthlyBudget(1000, 3, 30)).toBe(10000);
  });
});

describe('distributeBudgetAcrossWeeks（週次予算の自動入力：週への配分）', () => {
  it('日数比で按分し、端数は最終週に加算する', () => {
    // 31日を7/7/7/7/3日の5週に分割、月合計3100円
    const result = distributeBudgetAcrossWeeks(3100, [
      { weekNo: 1, days: 7 },
      { weekNo: 2, days: 7 },
      { weekNo: 3, days: 7 },
      { weekNo: 4, days: 7 },
      { weekNo: 5, days: 3 },
    ]);
    expect(result).toEqual([
      { weekNo: 1, amount: 700 },
      { weekNo: 2, amount: 700 },
      { weekNo: 3, amount: 700 },
      { weekNo: 4, amount: 700 },
      { weekNo: 5, amount: 300 },
    ]);
    expect(result.reduce((sum, w) => sum + w.amount, 0)).toBe(3100);
  });

  it('端数が出る配分でも合計が月合計予算と一致する', () => {
    const result = distributeBudgetAcrossWeeks(10000, [
      { weekNo: 1, days: 6 },
      { weekNo: 2, days: 7 },
      { weekNo: 3, days: 7 },
      { weekNo: 4, days: 7 },
      { weekNo: 5, days: 4 },
    ]);
    expect(result.reduce((sum, w) => sum + w.amount, 0)).toBe(10000);
  });

  it('週の合計日数が0件の場合は全週0円になる', () => {
    const result = distributeBudgetAcrossWeeks(5000, [{ weekNo: 1, days: 0 }]);
    expect(result).toEqual([{ weekNo: 1, amount: 0 }]);
  });
});
