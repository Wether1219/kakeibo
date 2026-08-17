import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardAlertBanner } from './DashboardAlertBanner';
import type { MonthlySettlement } from '../api/settlements';

function settlement(overrides: Partial<MonthlySettlement> = {}): MonthlySettlement {
  return {
    year: 2026,
    month: 5,
    direction: 'A_TO_B',
    fromUser: { userId: '1', displayName: 'たいよう' },
    toUser: { userId: '2', displayName: 'みらの' },
    amount: 3000,
    breakdown: {
      halfSplit: { totalAmount: 6000, fairShare: 3000, contributedByFrom: 0, subtotal: 3000 },
      otherFull: { subtotal: 0 },
    },
    transactionCount: 2,
    ...overrides,
  };
}

function renderBanner(props: Partial<Parameters<typeof DashboardAlertBanner>[0]>) {
  render(
    <MemoryRouter>
      <DashboardAlertBanner year={2026} month={5} overBudgetCount={0} settlement={null} {...props} />
    </MemoryRouter>
  );
}

describe('DashboardAlertBanner', () => {
  it('超過も精算もなければ何も表示しない', () => {
    const { container } = render(
      <MemoryRouter>
        <DashboardAlertBanner year={2026} month={5} overBudgetCount={0} settlement={null} />
      </MemoryRouter>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('精算のdirectionがNONEの場合は表示しない', () => {
    const { container } = render(
      <MemoryRouter>
        <DashboardAlertBanner
          year={2026}
          month={5}
          overBudgetCount={0}
          settlement={settlement({ direction: 'NONE', fromUser: null, toUser: null })}
        />
      </MemoryRouter>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('予算超過のみの場合はその行だけ表示する', () => {
    renderBanner({ overBudgetCount: 2 });
    expect(screen.getByText('週次予算を2件超過しています')).toBeInTheDocument();
    expect(screen.queryByText(/今月の精算/)).not.toBeInTheDocument();
  });

  it('精算のみの場合はその行だけ表示する', () => {
    renderBanner({ settlement: settlement() });
    expect(screen.getByText(/今月の精算：たいよう → みらの/)).toBeInTheDocument();
    expect(screen.queryByText(/件超過/)).not.toBeInTheDocument();
  });

  it('両方ある場合は両方表示する', () => {
    renderBanner({ overBudgetCount: 1, settlement: settlement() });
    expect(screen.getByText('週次予算を1件超過しています')).toBeInTheDocument();
    expect(screen.getByText(/今月の精算：たいよう → みらの/)).toBeInTheDocument();
  });
});
