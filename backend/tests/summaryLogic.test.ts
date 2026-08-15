import { describe, expect, it } from 'vitest';
import {
  ApportionableTransaction,
  apportionTransactionAmount,
  calculateMonthlySummaryForUser,
  calculateRatios,
  calculateSettlement,
  calculateWeekNumber,
  SettlementTransaction,
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

describe('calculateSettlement（割り勘・立て替え精算額の算出）', () => {
  function tx(partial: Partial<SettlementTransaction>): SettlementTransaction {
    return {
      splitType: 'shared',
      userId: null,
      createdBy: USER_A,
      amount: 0,
      otherPaidAmount: null,
      ...partial,
    };
  }

  it('①のみ（A支払い・shared）：Bが半額をAに支払う', () => {
    const result = calculateSettlement(
      [tx({ splitType: 'shared', createdBy: USER_A, amount: 1000 })],
      [USER_A, USER_B]
    );
    expect(result.netAmount).toBe(500);
    expect(result.payerIndex).toBe(1); // Bが支払う
    expect(result.breakdown[0]).toMatchObject({ sharedPaidTotal: 1000, sharedOtherPaidTotal: 0 });
  });

  it('②のみ（B支払い・shared）：Aが半額をBに支払う', () => {
    const result = calculateSettlement(
      [tx({ splitType: 'shared', createdBy: USER_B, amount: 1000 })],
      [USER_A, USER_B]
    );
    expect(result.netAmount).toBe(500);
    expect(result.payerIndex).toBe(0); // Aが支払う
  });

  it('③のみ（Aが払った・対象者=B個人）：Bが全額をAに支払う', () => {
    const result = calculateSettlement(
      [tx({ splitType: 'self', createdBy: USER_A, userId: USER_B, amount: 3000 })],
      [USER_A, USER_B]
    );
    expect(result.netAmount).toBe(3000);
    expect(result.payerIndex).toBe(1);
    expect(result.breakdown[0]).toMatchObject({ paidForOtherTotal: 3000, paidForOtherOtherPaidTotal: 0 });
  });

  it('④のみ（Bが払った・対象者=A個人）：Aが全額をBに支払う', () => {
    const result = calculateSettlement(
      [tx({ splitType: 'self', createdBy: USER_B, userId: USER_A, amount: 2000 })],
      [USER_A, USER_B]
    );
    expect(result.netAmount).toBe(2000);
    expect(result.payerIndex).toBe(0);
  });

  it('self×自分用（userId===createdBy）は精算対象外', () => {
    const result = calculateSettlement(
      [tx({ splitType: 'self', createdBy: USER_A, userId: USER_A, amount: 5000 })],
      [USER_A, USER_B]
    );
    expect(result.netAmount).toBe(0);
    expect(result.payerIndex).toBeNull();
    expect(result.breakdown[0]).toMatchObject({ sharedPaidTotal: 0, paidForOtherTotal: 0 });
  });

  it('居酒屋の例：sharedでotherPaidAmountが半額と一致する場合、その取引単体の精算は不要', () => {
    const result = calculateSettlement(
      [tx({ splitType: 'shared', createdBy: USER_A, amount: 4000, otherPaidAmount: 2000 })],
      [USER_A, USER_B]
    );
    expect(result.netAmount).toBe(0);
    expect(result.payerIndex).toBeNull();
    // 内訳はotherPaidAmount調整前の生の値を保持する
    expect(result.breakdown[0]).toMatchObject({ sharedPaidTotal: 4000, sharedOtherPaidTotal: 2000 });
  });

  it('複数取引が相殺してnetAmount=0になる', () => {
    const result = calculateSettlement(
      [
        tx({ splitType: 'shared', createdBy: USER_A, amount: 2000 }), // Aの寄与 +1000
        tx({ splitType: 'shared', createdBy: USER_B, amount: 2000 }), // Bの寄与 -1000
      ],
      [USER_A, USER_B]
    );
    expect(result.netAmount).toBe(0);
    expect(result.payerIndex).toBeNull();
  });

  it('端数の対称丸め：支払者が入れ替わっても端数1円の扱いが対称になる', () => {
    const byA = calculateSettlement(
      [tx({ splitType: 'shared', createdBy: USER_A, amount: 1 })],
      [USER_A, USER_B]
    );
    const byB = calculateSettlement(
      [tx({ splitType: 'shared', createdBy: USER_B, amount: 1 })],
      [USER_A, USER_B]
    );
    // Math.round単体だとMath.round(-0.5)=0になり非対称になってしまうため、両方とも1円になることを確認する
    expect(byA.netAmount).toBe(1);
    expect(byA.payerIndex).toBe(1);
    expect(byB.netAmount).toBe(1);
    expect(byB.payerIndex).toBe(0);
  });

  it('otherPaidAmountが半額を超えると精算方向が反転する', () => {
    const result = calculateSettlement(
      [tx({ splitType: 'shared', createdBy: USER_A, amount: 1000, otherPaidAmount: 800 })],
      [USER_A, USER_B]
    );
    // Bの本来の取り分は500円だが現地で800円払っているため、300円分はAがBに払う
    expect(result.netAmount).toBe(300);
    expect(result.payerIndex).toBe(0);
  });

  it('0件（空配列）は全て0になる', () => {
    const result = calculateSettlement([], [USER_A, USER_B]);
    expect(result.netAmount).toBe(0);
    expect(result.payerIndex).toBeNull();
    expect(result.breakdown[0]).toMatchObject({
      sharedPaidTotal: 0,
      sharedOtherPaidTotal: 0,
      paidForOtherTotal: 0,
      paidForOtherOtherPaidTotal: 0,
    });
    expect(result.breakdown[1]).toMatchObject({
      sharedPaidTotal: 0,
      sharedOtherPaidTotal: 0,
      paidForOtherTotal: 0,
      paidForOtherOtherPaidTotal: 0,
    });
  });
});
