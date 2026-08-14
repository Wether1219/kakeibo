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
    <div className="rounded border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-gray-500 mb-3">{displayName}</h3>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-500">収入</dt>
          <dd className="font-medium">{formatYen(income)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">先取り貯金</dt>
          <dd className="font-medium">{formatYen(preSaving)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">支出</dt>
          <dd className="font-medium">{formatYen(expense)}</dd>
        </div>
        <div className="flex justify-between border-t border-gray-100 pt-2">
          <dt className="text-gray-500">余り貯金</dt>
          <dd className={`font-bold ${remainingSaving < 0 ? 'text-red-600' : ''}`}>
            {formatYen(remainingSaving)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">貯金合計</dt>
          <dd className="font-bold">{formatYen(totalSaving)}</dd>
        </div>
      </dl>
    </div>
  );
}
