interface Props {
  netAmount: number;
  fromDisplayName: string | null;
  toDisplayName: string | null;
}

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

export function SettlementResultCard({ netAmount, fromDisplayName, toDisplayName }: Props) {
  const isSettled = netAmount === 0 || fromDisplayName === null || toDisplayName === null;

  return (
    <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm text-center">
      {isSettled ? (
        <p className="text-lg font-bold text-gray-500 dark:text-gray-400">精算不要です</p>
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">精算額</p>
          <p className="text-2xl font-bold">
            {fromDisplayName} <span className="text-blue-600 dark:text-blue-400">→</span> {toDisplayName}
          </p>
          <p className="text-3xl font-bold mt-2">{formatYen(netAmount)}</p>
        </>
      )}
    </div>
  );
}
