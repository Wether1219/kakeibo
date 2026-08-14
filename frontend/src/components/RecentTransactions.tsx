import { Category } from '../api/categories';
import { Transaction } from '../api/transactions';
import { User } from '../api/users';

interface Props {
  transactions: Transaction[];
  categories: Category[];
  users: User[];
  onShowMore?: () => void;
  onDelete?: (id: string) => void | Promise<void>;
}

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  return `${Number(month)}/${Number(day)}`;
}

export function RecentTransactions({ transactions, categories, users, onShowMore, onDelete }: Props) {
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const userMap = new Map(users.map((u) => [u.id, u]));

  const handleDelete = (t: Transaction) => {
    if (!onDelete) return;
    const category = categoryMap.get(t.categoryId);
    const label = `${formatDate(t.transactionDate)} ${category?.name ?? ''} ${formatYen(t.amount)}`;
    if (!window.confirm(`この取引を削除しますか？\n${label}`)) return;
    onDelete(t.id);
  };

  return (
    <section>
      <h2 className="text-sm font-bold text-gray-500 mb-2">直近取引（最新{transactions.length}件）</h2>
      <div className="rounded border border-gray-200 bg-white divide-y divide-gray-100">
        {transactions.length === 0 && (
          <p className="px-4 py-4 text-sm text-gray-400">取引がありません</p>
        )}
        {transactions.map((t) => {
          const category = categoryMap.get(t.categoryId);
          const targetName = t.splitType === 'shared' ? '共通' : userMap.get(t.userId ?? '')?.displayName ?? '-';
          return (
            <div key={t.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="text-gray-400 w-10 shrink-0">{formatDate(t.transactionDate)}</span>
              <span className="w-24 shrink-0 truncate">
                {category?.icon ?? ''}
                {category?.name ?? ''}
              </span>
              <span className="w-16 shrink-0 text-gray-500">{targetName}</span>
              <span className="w-20 shrink-0 text-right font-medium">{formatYen(t.amount)}</span>
              <span className="flex-1 truncate text-gray-500">{t.memo}</span>
              {onDelete && (
                <button
                  type="button"
                  aria-label="削除"
                  className="shrink-0 text-gray-400 hover:text-red-600"
                  onClick={() => handleDelete(t)}
                >
                  削除
                </button>
              )}
            </div>
          );
        })}
      </div>
      {onShowMore && (
        <div className="text-right mt-2">
          <button type="button" className="text-sm text-blue-600 hover:underline" onClick={onShowMore}>
            もっと見る
          </button>
        </div>
      )}
    </section>
  );
}
