import { SettlementDirection, SettlementUser } from '../api/summary';

interface Props {
  direction: SettlementDirection;
  amount: number;
  fromUser: SettlementUser | null;
  toUser: SettlementUser | null;
}

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

export function SettlementResultCard({ direction, amount, fromUser, toUser }: Props) {
  const isSettled = direction === 'NONE' || fromUser === null || toUser === null;

  return (
    <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm text-center">
      {isSettled ? (
        <p className="text-lg font-bold text-gray-500 dark:text-gray-400">精算不要です</p>
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">精算額</p>
          <p className="text-2xl font-bold">
            {fromUser.displayName} <span className="text-blue-600 dark:text-blue-400">→</span> {toUser.displayName}
          </p>
          <p className="text-3xl font-bold mt-2">{formatYen(amount)}</p>
        </>
      )}
    </div>
  );
}
