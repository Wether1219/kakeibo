import { SettlementBreakdownRow } from '../api/summary';

interface Props {
  breakdown: SettlementBreakdownRow[];
}

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

export function SettlementBreakdownTable({ breakdown }: Props) {
  return (
    <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
      <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3">内訳</h3>
      <div className="space-y-4">
        {breakdown.map((row) => (
          <div key={row.userId}>
            <h4 className="text-sm font-bold mb-2">{row.displayName}が支払った分</h4>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">対象者「両方」</dt>
                <dd className="font-medium text-right">
                  {formatYen(row.sharedPaidTotal)}
                  {row.sharedOtherPaidTotal > 0 && (
                    <span className="block text-xs text-gray-400 dark:text-gray-500">
                      （うち相手が直接支払: -{formatYen(row.sharedOtherPaidTotal)}）
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">相手個人のために</dt>
                <dd className="font-medium text-right">
                  {formatYen(row.paidForOtherTotal)}
                  {row.paidForOtherOtherPaidTotal > 0 && (
                    <span className="block text-xs text-gray-400 dark:text-gray-500">
                      （うち相手が直接支払: -{formatYen(row.paidForOtherOtherPaidTotal)}）
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
