import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useDateRangeParams } from './useDateRangeParams';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

describe('useDateRangeParams', () => {
  it('URLに?startDate=&endDate=がない場合は当月1日〜今日を返す', () => {
    const { result } = renderHook(() => useDateRangeParams(), {
      wrapper: ({ children }) => <MemoryRouter initialEntries={['/settlement']}>{children}</MemoryRouter>,
    });
    expect(result.current.startDate).toBe(`${todayStr().slice(0, 7)}-01`);
    expect(result.current.endDate).toBe(todayStr());
  });

  it('URLの?startDate=&endDate=を読み取る', () => {
    const { result } = renderHook(() => useDateRangeParams(), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={['/settlement?startDate=2026-05-01&endDate=2026-05-31']}>
          {children}
        </MemoryRouter>
      ),
    });
    expect(result.current.startDate).toBe('2026-05-01');
    expect(result.current.endDate).toBe('2026-05-31');
  });

  it('不正な形式が指定されている場合はデフォルトにフォールバックする', () => {
    const { result } = renderHook(() => useDateRangeParams(), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={['/settlement?startDate=2026/05/01&endDate=abc']}>
          {children}
        </MemoryRouter>
      ),
    });
    expect(result.current.startDate).toBe(`${todayStr().slice(0, 7)}-01`);
    expect(result.current.endDate).toBe(todayStr());
  });

  it('setDateRangeで期間を更新できる', () => {
    const { result } = renderHook(() => useDateRangeParams(), {
      wrapper: ({ children }) => <MemoryRouter initialEntries={['/settlement']}>{children}</MemoryRouter>,
    });
    act(() => {
      result.current.setDateRange('2025-01-01', '2025-01-31');
    });
    expect(result.current.startDate).toBe('2025-01-01');
    expect(result.current.endDate).toBe('2025-01-31');
  });
});
