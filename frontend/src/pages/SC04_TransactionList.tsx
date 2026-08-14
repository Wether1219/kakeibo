import { useMemo, useState } from 'react';
import { MonthSelector } from '../components/MonthSelector';
import { EditTransactionModal } from '../components/EditTransactionModal';
import { useTransactionList } from '../hooks/useTransactionList';
import { useYearMonthParams } from '../hooks/useYearMonthParams';
import type { Transaction } from '../api/transactions';

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  return `${Number(month)}/${Number(day)}`;
}

// SC04（取引一覧・編集画面）：対象月の取引をリスト表示し、費目・キーワードで絞り込み、編集・削除できる。
export function SC04_TransactionList() {
  const { year, month, setYearMonth } = useYearMonthParams();
  const { transactions, categories, users, loading, error, reload, removeTransaction } =
    useTransactionList(year, month);
  const [categoryId, setCategoryId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const filtered = transactions.filter((t) => {
    if (categoryId && t.categoryId !== categoryId) return false;
    const trimmedKeyword = keyword.trim();
    if (trimmedKeyword) {
      const category = categoryMap.get(t.categoryId);
      const haystack = `${category?.name ?? ''} ${t.memo ?? ''}`;
      if (!haystack.includes(trimmedKeyword)) return false;
    }
    return true;
  });

  const handleDelete = async (t: Transaction) => {
    const category = categoryMap.get(t.categoryId);
    const label = `${formatDate(t.transactionDate)} ${category?.name ?? ''} ${formatYen(t.amount)}`;
    if (!window.confirm(`この取引を削除しますか？\n${label}`)) return;
    setActionError(null);
    try {
      await removeTransaction(t.id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">取引一覧</h1>
      <MonthSelector year={year} month={month} onChange={setYearMonth} />

      <div className="flex flex-col sm:flex-row gap-2">
        <select
          className="border border-gray-300 rounded px-2 py-1.5 text-sm flex-1"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">すべての費目</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon ?? ''} {c.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="費目名・メモで検索"
          className="border border-gray-300 rounded px-2 py-1.5 text-sm flex-1"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>

      {loading && <p className="text-sm text-gray-400">読み込み中...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      {!loading && (
        <div className="rounded border border-gray-200 bg-white divide-y divide-gray-100">
          {filtered.length === 0 && (
            <p className="px-4 py-4 text-sm text-gray-400">取引がありません</p>
          )}
          {filtered.map((t) => {
            const category = categoryMap.get(t.categoryId);
            const targetName =
              t.splitType === 'shared' ? '共通' : userMap.get(t.userId ?? '')?.displayName ?? '-';
            return (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="text-gray-400 w-10 shrink-0">{formatDate(t.transactionDate)}</span>
                <span className="w-28 shrink-0 truncate">
                  {category?.icon ?? ''}
                  {category?.name ?? ''}
                </span>
                <span className="w-16 shrink-0 text-gray-500">{targetName}</span>
                <span className="w-20 shrink-0 text-right font-medium">{formatYen(t.amount)}</span>
                <span className="flex-1 truncate text-gray-500">{t.memo}</span>
                <button
                  type="button"
                  className="shrink-0 text-blue-600 hover:underline"
                  onClick={() => setEditing(t)}
                >
                  編集
                </button>
                <button
                  type="button"
                  aria-label="削除"
                  className="shrink-0 text-gray-400 hover:text-red-600"
                  onClick={() => handleDelete(t)}
                >
                  削除
                </button>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <EditTransactionModal transaction={editing} onClose={() => setEditing(null)} onSaved={reload} />
      )}
    </div>
  );
}
