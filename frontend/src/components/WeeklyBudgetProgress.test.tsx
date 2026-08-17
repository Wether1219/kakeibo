import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeeklyBudgetProgress } from './WeeklyBudgetProgress';
import type { WeeklyBudgetWithActual } from '../api/weeklyBudgets';

function row(overrides: Partial<WeeklyBudgetWithActual>): WeeklyBudgetWithActual {
  return {
    weekNo: 1,
    categoryId: 'c1',
    categoryName: '食費',
    categoryIcon: '🍙',
    budgetAmount: 5000,
    actualAmount: 0,
    diff: 5000,
    hasBudget: true,
    suggestedAmount: 0,
    ...overrides,
  };
}

describe('WeeklyBudgetProgress', () => {
  it('予算内の費目には超過バッジを表示しない', () => {
    render(<WeeklyBudgetProgress rows={[row({ budgetAmount: 5000, actualAmount: 3000 })]} />);
    expect(screen.queryByText('超過')).not.toBeInTheDocument();
    expect(screen.queryByText(/件超過/)).not.toBeInTheDocument();
  });

  it('実績が予算を超えた費目には超過バッジを表示する', () => {
    render(
      <WeeklyBudgetProgress
        rows={[row({ categoryName: '食費', budgetAmount: 5000, actualAmount: 6000 })]}
      />
    );
    expect(screen.getByText('超過')).toBeInTheDocument();
    expect(screen.getByText('1件超過')).toBeInTheDocument();
  });

  it('同一費目の複数週は合算してから予算と比較する', () => {
    // 週1・週2それぞれは予算内でも、合計では超過するケース
    render(
      <WeeklyBudgetProgress
        rows={[
          row({ weekNo: 1, categoryId: 'c1', budgetAmount: 3000, actualAmount: 2000 }),
          row({ weekNo: 2, categoryId: 'c1', budgetAmount: 3000, actualAmount: 5000 }),
        ]}
      />
    );
    // 合計: 予算6000 / 実績7000 → 超過
    expect(screen.getByText('1件超過')).toBeInTheDocument();
  });

  it('予算が設定されている費目がない場合はメッセージを表示する', () => {
    render(<WeeklyBudgetProgress rows={[row({ budgetAmount: 0, actualAmount: 0 })]} />);
    expect(screen.getByText('予算が設定されていません')).toBeInTheDocument();
  });
});
