import { describe, expect, it } from 'vitest';
import { sumAmounts } from './ExpensePieCharts';

describe('sumAmounts（世帯合計タブの集計ロジック）', () => {
  it('複数ユーザー分のamountsを合算する', () => {
    expect(sumAmounts({ '1': 1000, '2': 2000 })).toBe(3000);
  });

  it('空のamountsは0を返す', () => {
    expect(sumAmounts({})).toBe(0);
  });
});
