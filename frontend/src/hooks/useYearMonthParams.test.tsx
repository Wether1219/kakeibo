import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useYearMonthParams, useYearParam } from './useYearMonthParams';

describe('useYearMonthParams', () => {
  it('URLに?year=&month=がない場合は現在の年月を返す', () => {
    const now = new Date();
    const { result } = renderHook(() => useYearMonthParams(), {
      wrapper: ({ children }) => <MemoryRouter initialEntries={['/dashboard']}>{children}</MemoryRouter>,
    });
    expect(result.current.year).toBe(now.getFullYear());
    expect(result.current.month).toBe(now.getMonth() + 1);
  });

  it('URLの?year=&month=を読み取る', () => {
    const { result } = renderHook(() => useYearMonthParams(), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={['/dashboard?year=2024&month=3']}>{children}</MemoryRouter>
      ),
    });
    expect(result.current.year).toBe(2024);
    expect(result.current.month).toBe(3);
  });

  it('不正なmonth（13）が指定されている場合は現在の月にフォールバックする', () => {
    const now = new Date();
    const { result } = renderHook(() => useYearMonthParams(), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={['/dashboard?year=2024&month=13']}>{children}</MemoryRouter>
      ),
    });
    expect(result.current.year).toBe(2024);
    expect(result.current.month).toBe(now.getMonth() + 1);
  });

  it('setYearMonthで年月を更新できる', () => {
    const { result } = renderHook(() => useYearMonthParams(), {
      wrapper: ({ children }) => <MemoryRouter initialEntries={['/dashboard']}>{children}</MemoryRouter>,
    });
    act(() => {
      result.current.setYearMonth(2023, 12);
    });
    expect(result.current.year).toBe(2023);
    expect(result.current.month).toBe(12);
  });
});

describe('useYearParam', () => {
  it('URLに?year=がない場合は現在の年を返す', () => {
    const now = new Date();
    const { result } = renderHook(() => useYearParam(), {
      wrapper: ({ children }) => <MemoryRouter initialEntries={['/annual-trend']}>{children}</MemoryRouter>,
    });
    expect(result.current[0]).toBe(now.getFullYear());
  });

  it('setYearで年を更新できる', () => {
    const { result } = renderHook(() => useYearParam(), {
      wrapper: ({ children }) => <MemoryRouter initialEntries={['/annual-trend']}>{children}</MemoryRouter>,
    });
    act(() => {
      result.current[1](2022);
    });
    expect(result.current[0]).toBe(2022);
  });
});
