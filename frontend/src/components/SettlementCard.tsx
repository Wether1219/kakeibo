import { useState } from 'react';
import { MonthlySettlement } from '../api/settlements';

interface Props {
  settlement: MonthlySettlement | null;
  loading: boolean;
  error: string | null;
}

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

export function SettlementCard({ settlement, loading, error }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section>
      <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2">💴 今月の割り勘精算</h2>
      <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
        {loading && <p className="text-sm text-gray-400 dark:text-gray-500">読み込み中...</p>}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {!loading && !error && settlement && settlement.direction === 'NONE' && (
          <p className="text-sm text-gray-400 dark:text-gray-500">今月は精算不要です</p>
        )}

        {!loading && !error && settlement && settlement.direction !== 'NONE' && settlement.fromUser && settlement.toUser && (
          <>
            <div className="text-center py-2">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                {settlement.fromUser.displayName} → {settlement.toUser.displayName}
              </p>
              <p className="text-2xl font-bold mt-1">{formatYen(Math.abs(settlement.amount))}</p>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500 dark:text-gray-400">対象取引 {settlement.transactionCount}件</span>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="text-blue-600 dark:text-blue-400 font-medium"
              >
                内訳を見る {expanded ? '▲' : '▼'}
              </button>
            </div>

            {expanded && (
              <div className="rounded bg-gray-50 dark:bg-gray-900 p-3 text-sm space-y-2">
                <div>
                  <div className="flex justify-between font-medium">
                    <span>折半分</span>
                    <span>{formatYen(settlement.breakdown.halfSplit.subtotal)}</span>
                  </div>
                  <dl className="pl-3 mt-1 space-y-0.5 text-gray-500 dark:text-gray-400">
                    <div className="flex justify-between">
                      <dt>対象総額</dt>
                      <dd>{formatYen(settlement.breakdown.halfSplit.totalAmount)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>公平負担</dt>
                      <dd>{formatYen(settlement.breakdown.halfSplit.fairShare)}/人</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>実質拠出</dt>
                      <dd>{formatYen(settlement.breakdown.halfSplit.contributedByFrom)}</dd>
                    </div>
                  </dl>
                </div>
                <div className="flex justify-between font-medium">
                  <span>全額負担分</span>
                  <span>{formatYen(settlement.breakdown.otherFull.subtotal)}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
