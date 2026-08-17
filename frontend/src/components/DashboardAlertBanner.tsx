import { Link } from 'react-router-dom';
import { MonthlySettlement } from '../api/settlements';

interface Props {
  year: number;
  month: number;
  overBudgetCount: number;
  settlement: MonthlySettlement | null;
}

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

// ダッシュボード訪問時に週次予算の超過・今月の精算額を能動的に知らせるバナー。
// push通知は導入せず、useDashboard/useMonthlySettlementが既に取得済みのデータのみで完結させる。
export function DashboardAlertBanner({ year, month, overBudgetCount, settlement }: Props) {
  const hasSettlement = settlement !== null && settlement.direction !== 'NONE' && settlement.fromUser && settlement.toUser;

  if (overBudgetCount === 0 && !hasSettlement) {
    return null;
  }

  return (
    <section className="rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 p-3 space-y-1 text-sm">
      {overBudgetCount > 0 && (
        <Link
          to={`/weekly-budget?year=${year}&month=${month}`}
          className="flex items-center justify-between text-amber-800 dark:text-amber-200 hover:underline"
        >
          <span>週次予算を{overBudgetCount}件超過しています</span>
          <span aria-hidden="true">→</span>
        </Link>
      )}
      {hasSettlement && settlement && settlement.fromUser && settlement.toUser && (
        <Link
          to={`/settlement?year=${year}&month=${month}`}
          className="flex items-center justify-between text-amber-800 dark:text-amber-200 hover:underline"
        >
          <span>
            今月の精算：{settlement.fromUser.displayName} → {settlement.toUser.displayName}{' '}
            {formatYen(Math.abs(settlement.amount))}
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      )}
    </section>
  );
}
