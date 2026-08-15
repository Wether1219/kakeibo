import { SettlementBreakdown } from '../api/summary';

interface Props {
  breakdown: SettlementBreakdown;
}

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

export function SettlementBreakdownTable({ breakdown }: Props) {
  return (
    <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
      <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3">内訳</h3>
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-bold mb-2">折半</h4>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">対象額合計</dt>
              <dd className="font-medium">{formatYen(breakdown.halfSplit.totalAmount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">1人分の負担額</dt>
              <dd className="font-medium">{formatYen(breakdown.halfSplit.fairShare)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">既に負担した額</dt>
              <dd className="font-medium">{formatYen(breakdown.halfSplit.contributedByFrom)}</dd>
            </div>
          </dl>
        </div>
        <div>
          <h4 className="text-sm font-bold mb-2">全額相手負担</h4>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">小計</dt>
              <dd className="font-medium">{formatYen(breakdown.otherFull.subtotal)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
