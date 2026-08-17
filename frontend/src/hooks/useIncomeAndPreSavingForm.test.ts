import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/users', () => ({
  fetchUsers: vi.fn(async () => [{ id: '1', householdId: '1', displayName: 'たいよう' }]),
}));

vi.mock('../api/categories', () => ({
  fetchCategories: vi.fn(async (type: string) =>
    type === 'income'
      ? [{ id: '10', householdId: '1', type: 'income', name: '給与', icon: null, sortOrder: 0, isActive: true, createdAt: '' }]
      : [{ id: '20', householdId: '1', type: 'pre_saving', name: '積立NISA', icon: null, sortOrder: 0, isActive: true, createdAt: '' }]
  ),
}));

vi.mock('../api/incomes', () => ({
  fetchIncomes: vi.fn(async () => []),
  bulkUpdateIncomes: vi.fn(async () => []),
}));

vi.mock('../api/preSavings', () => ({
  fetchPreSavings: vi.fn(async () => []),
  bulkUpdatePreSavings: vi.fn(async () => []),
}));

import * as incomesApi from '../api/incomes';
import * as preSavingsApi from '../api/preSavings';
import { useIncomeAndPreSavingForm } from './useIncomeAndPreSavingForm';

describe('useIncomeAndPreSavingForm 自動保存', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('収入入力はデバウンス後に1回だけbulkUpdateIncomesを呼ぶ', async () => {
    const { result } = renderHook(() => useIncomeAndPreSavingForm(2026, 5));
    await waitFor(() => expect(result.current.loading).toBe(false));

    vi.useFakeTimers();
    act(() => {
      result.current.setIncomeAmount('1', '10', 5000);
    });
    expect(incomesApi.bulkUpdateIncomes).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(incomesApi.bulkUpdateIncomes).toHaveBeenCalledTimes(1);
    expect(incomesApi.bulkUpdateIncomes).toHaveBeenCalledWith([
      { year: 2026, month: 5, userId: '1', categoryId: '10', amount: 5000 },
    ]);
  });

  it('pre_savingsのbudget編集後にactualを編集しても、直前に保存した値を上書きしない', async () => {
    vi.mocked(preSavingsApi.fetchPreSavings).mockResolvedValueOnce([
      {
        id: 'p1',
        householdId: '1',
        year: 2026,
        month: 5,
        userId: '1',
        categoryId: '20',
        budgetAmount: 1000,
        actualAmount: 500,
        createdAt: '',
      },
    ]);
    const { result } = renderHook(() => useIncomeAndPreSavingForm(2026, 5));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.preSavingBudgets['1:20']).toBe(1000);
    expect(result.current.preSavingActuals['1:20']).toBe(500);

    vi.useFakeTimers();
    act(() => {
      result.current.setPreSavingActual('1', '20', 800);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(preSavingsApi.bulkUpdatePreSavings).toHaveBeenCalledWith([
      { year: 2026, month: 5, userId: '1', categoryId: '20', budgetAmount: 1000, actualAmount: 800 },
    ]);

    vi.mocked(preSavingsApi.bulkUpdatePreSavings).mockClear();

    // 直前に保存済みのactual(800)を古い値で上書きせず、budgetの変更と合わせて送信されること
    act(() => {
      result.current.setPreSavingBudget('1', '20', 1200);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(preSavingsApi.bulkUpdatePreSavings).toHaveBeenCalledWith([
      { year: 2026, month: 5, userId: '1', categoryId: '20', budgetAmount: 1200, actualAmount: 800 },
    ]);
  });

  it('同一セルのbudget/actualをデバウンス時間内に連続編集しても、最後に1回だけ両方の最新値で保存される', async () => {
    const { result } = renderHook(() => useIncomeAndPreSavingForm(2026, 5));
    await waitFor(() => expect(result.current.loading).toBe(false));

    vi.useFakeTimers();
    act(() => {
      result.current.setPreSavingActual('1', '20', 800);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    act(() => {
      result.current.setPreSavingBudget('1', '20', 1200);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(preSavingsApi.bulkUpdatePreSavings).toHaveBeenCalledTimes(1);
    expect(preSavingsApi.bulkUpdatePreSavings).toHaveBeenCalledWith([
      { year: 2026, month: 5, userId: '1', categoryId: '20', budgetAmount: 1200, actualAmount: 800 },
    ]);
  });
});
