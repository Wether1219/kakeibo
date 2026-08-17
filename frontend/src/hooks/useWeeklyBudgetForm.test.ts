import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/weeklyBudgets', () => ({
  fetchWeeklyBudgets: vi.fn(async () => [
    {
      weekNo: 1,
      categoryId: '10',
      categoryName: '食費',
      categoryIcon: '🍙',
      budgetAmount: 3000,
      actualAmount: 1000,
      diff: 2000,
      hasBudget: true,
      suggestedAmount: 0,
    },
  ]),
  bulkUpdateWeeklyBudgets: vi.fn(async () => []),
}));

import * as weeklyBudgetsApi from '../api/weeklyBudgets';
import { useWeeklyBudgetForm } from './useWeeklyBudgetForm';

describe('useWeeklyBudgetForm 自動保存', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('セル編集後、デバウンス時間が経過するまではAPIを呼ばず、経過後に1回だけ呼ぶ', async () => {
    const { result } = renderHook(() => useWeeklyBudgetForm(2026, 5));
    await waitFor(() => expect(result.current.loading).toBe(false));

    vi.useFakeTimers();
    act(() => {
      result.current.setBudget(1, '10', 4000);
    });
    expect(result.current.isSaving(1, '10')).toBe(true);
    expect(weeklyBudgetsApi.bulkUpdateWeeklyBudgets).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(499);
    });
    expect(weeklyBudgetsApi.bulkUpdateWeeklyBudgets).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(weeklyBudgetsApi.bulkUpdateWeeklyBudgets).toHaveBeenCalledTimes(1);
    expect(weeklyBudgetsApi.bulkUpdateWeeklyBudgets).toHaveBeenCalledWith([
      { year: 2026, month: 5, weekNo: 1, categoryId: '10', budgetAmount: 4000 },
    ]);
    expect(result.current.isSaving(1, '10')).toBe(false);
  });

  it('デバウンス時間内の連続編集は最後の値のみで1回保存される', async () => {
    const { result } = renderHook(() => useWeeklyBudgetForm(2026, 5));
    await waitFor(() => expect(result.current.loading).toBe(false));

    vi.useFakeTimers();
    act(() => {
      result.current.setBudget(1, '10', 4000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    act(() => {
      result.current.setBudget(1, '10', 4500);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(weeklyBudgetsApi.bulkUpdateWeeklyBudgets).toHaveBeenCalledTimes(1);
    expect(weeklyBudgetsApi.bulkUpdateWeeklyBudgets).toHaveBeenCalledWith([
      { year: 2026, month: 5, weekNo: 1, categoryId: '10', budgetAmount: 4500 },
    ]);
  });
});
