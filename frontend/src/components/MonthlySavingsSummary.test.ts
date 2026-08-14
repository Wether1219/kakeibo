import { describe, expect, it } from 'vitest';
import { calculateMonthlyIncome, calculateMonthlyTotalSaving } from './MonthlySavingsSummary';
import type { AnnualSummaryRow } from '../api/summary';

function row(overrides: Partial<AnnualSummaryRow>): AnnualSummaryRow {
  return {
    categoryType: 'income',
    categoryName: '給与',
    userId: 'u1',
    displayName: 'たいよう',
    months: new Array(12).fill(0),
    annualTotal: 0,
    ...overrides,
  };
}

describe('calculateMonthlyTotalSaving', () => {
  it('貯金合計 = 収入 - 支出（先取り貯金は貯金合計に影響しない、5.3節の展開式通り）', () => {
    const rows: AnnualSummaryRow[] = [
      row({ categoryType: 'income', userId: 'u1', months: [300000, ...new Array(11).fill(0)] }),
      row({
        categoryType: 'fixed_expense',
        userId: 'u1',
        months: [80000, ...new Array(11).fill(0)],
      }),
      row({
        categoryType: 'variable_expense',
        userId: 'u1',
        months: [50000, ...new Array(11).fill(0)],
      }),
      row({
        categoryType: 'pre_saving',
        userId: 'u1',
        months: [100000, ...new Array(11).fill(0)],
      }),
    ];
    const result = calculateMonthlyTotalSaving(rows, 'u1');
    // 300000(収入) - 80000(固定費) - 50000(変動費) = 170000。pre_savingは加減算に含めない。
    expect(result[0]).toBe(170000);
    expect(result.slice(1)).toEqual(new Array(11).fill(0));
  });

  it('他ユーザーの行は集計対象に含めない', () => {
    const rows: AnnualSummaryRow[] = [
      row({ categoryType: 'income', userId: 'u1', months: [100000, ...new Array(11).fill(0)] }),
      row({ categoryType: 'income', userId: 'u2', months: [200000, ...new Array(11).fill(0)] }),
    ];
    expect(calculateMonthlyTotalSaving(rows, 'u1')[0]).toBe(100000);
    expect(calculateMonthlyTotalSaving(rows, 'u2')[0]).toBe(200000);
  });

  it('支出が収入を上回る月はマイナスになる', () => {
    const rows: AnnualSummaryRow[] = [
      row({ categoryType: 'income', userId: 'u1', months: [10000, ...new Array(11).fill(0)] }),
      row({
        categoryType: 'variable_expense',
        userId: 'u1',
        months: [15000, ...new Array(11).fill(0)],
      }),
    ];
    expect(calculateMonthlyTotalSaving(rows, 'u1')[0]).toBe(-5000);
  });
});

describe('calculateMonthlyIncome', () => {
  it('income区分の行のみを合算する', () => {
    const rows: AnnualSummaryRow[] = [
      row({ categoryType: 'income', userId: 'u1', months: [100000, ...new Array(11).fill(0)] }),
      row({
        categoryType: 'variable_expense',
        userId: 'u1',
        months: [50000, ...new Array(11).fill(0)],
      }),
    ];
    expect(calculateMonthlyIncome(rows, 'u1')[0]).toBe(100000);
  });
});
