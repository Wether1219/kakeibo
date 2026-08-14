interface Props {
  displayName: string;
  income: number;
  preSaving: number;
  expense: number;
  remainingSaving: number;
  totalSaving: number;
}

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

export function BalanceSummaryCard({
  displayName,
  income,
  preSaving,
  expense,
  remainingSaving,
  totalSaving,
}: Props) {
  return (
    <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
      <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3">{displayName}</h3>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-500 dark:text-gray-400">収入</dt>
          <dd className="font-medium">{formatYen(income)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500 dark:text-gray-400">先取り貯金</dt>
          <dd className="font-medium">{formatYen(preSaving)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500 dark:text-gray-400">支出</dt>
          <dd className="font-medium">{formatYen(expense)}</dd>
        </div>
        <div className="flex justify-between border-t border-gray-100 dark:border-gray-700 pt-2">
          <dt className="text-gray-500 dark:text-gray-400">余り貯金</dt>
          <dd className={`font-bold ${remainingSaving < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
            {formatYen(remainingSaving)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500 dark:text-gray-400">貯金合計</dt>
          <dd className="font-bold">{formatYen(totalSaving)}</dd>
        </div>
      </dl>
    </div>
  );
}
