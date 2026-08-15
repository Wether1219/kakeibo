import { useEffect, useMemo, useState } from 'react';
import { MonthSelector } from '../components/MonthSelector';
import { EditTransactionModal } from '../components/EditTransactionModal';
import { ErrorMessage, LoadingMessage } from '../components/StatusMessage';
import { TRANSACTION_PAGE_SIZE, useTransactionList } from '../hooks/useTransactionList';
import { useYearMonthParams } from '../hooks/useYearMonthParams';
import type { Transaction } from '../api/transactions';

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  return `${Number(month)}/${Number(day)}`;
}

// SC04（取引一覧・編集画面）：対象月の取引をサーバー側の費目・キーワード検索＋ページネーションで表示し、編集・削除できる。
export function SC04_TransactionList() {
  const { year, month, setYearMonth } = useYearMonthParams();
  const [categoryId, setCategoryId] = useState('');
  const [target, setTarget] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // キーワード入力は300msデバウンスしてから検索に反映する（毎打鍵でのAPI呼び出しを避ける）。
  useEffect(() => {
    const timer = setTimeout(() => setKeyword(keywordInput), 300);
    return () => clearTimeout(timer);
  }, [keywordInput]);

  // 絞り込み条件が変わったら1ページ目に戻す。
  useEffect(() => {
    setPage(0);
  }, [year, month, categoryId, target, keyword]);

  const { transactions, total, categories, users, loading, error, reload, removeTransaction } =
    useTransactionList(year, month, categoryId, target, keyword, page);

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  // 絞り込みプルダウンには、取引で実際に使われうる区分（固定費/変動費）かつ有効な費目のみ表示する
  // （費目マスタ画面と同じ「有効な費目」の範囲に合わせ、無効化済みや収入/先取り貯金の費目は出さない）。
  const filterableCategories = useMemo(
    () =>
      categories.filter(
        (c) => c.isActive && (c.type === 'fixed_expense' || c.type === 'variable_expense')
      ),
    [categories]
  );
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const totalPages = Math.max(1, Math.ceil(total / TRANSACTION_PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : page * TRANSACTION_PAGE_SIZE + 1;
  const rangeEnd = Math.min(total, (page + 1) * TRANSACTION_PAGE_SIZE);

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
          className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1.5 text-sm flex-1"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">すべての費目</option>
          {filterableCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon ?? ''} {c.name}
            </option>
          ))}
        </select>
        <select
          className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1.5 text-sm flex-1"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          <option value="">すべての対象者</option>
          <option value="shared">共通</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="費目名・メモで検索"
          className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1.5 text-sm flex-1"
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
        />
      </div>

      {loading && <LoadingMessage />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {actionError && <ErrorMessage>{actionError}</ErrorMessage>}

      {!loading && (
        <>
          <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
            {transactions.length === 0 && (
              <p className="px-4 py-4 text-sm text-gray-400 dark:text-gray-500">取引がありません</p>
            )}
            {transactions.map((t) => {
              const category = categoryMap.get(t.categoryId);
              const targetName =
                t.splitType === 'shared' ? '共通' : userMap.get(t.userId ?? '')?.displayName ?? '-';
              return (
                <div key={t.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className="text-gray-400 dark:text-gray-500 w-10 shrink-0">{formatDate(t.transactionDate)}</span>
                  <span className="w-28 shrink-0 truncate">
                    {category?.icon ?? ''}
                    {category?.name ?? ''}
                  </span>
                  <span className="w-16 shrink-0 text-gray-500 dark:text-gray-400">{targetName}</span>
                  <span className="w-20 shrink-0 text-right font-medium">{formatYen(t.amount)}</span>
                  <span className="flex-1 truncate text-gray-500 dark:text-gray-400">{t.memo}</span>
                  <button
                    type="button"
                    className="shrink-0 text-blue-600 dark:text-blue-400 hover:underline"
                    onClick={() => setEditing(t)}
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    aria-label="削除"
                    className="shrink-0 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                    onClick={() => handleDelete(t)}
                  >
                    削除
                  </button>
                </div>
              );
            })}
          </div>

          {total > 0 && (
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>
                {rangeStart}-{rangeEnd} / 全{total}件
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-40"
                >
                  前へ
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 rounded border border-gray-300 dark:border-gray-700 disabled:opacity-40"
                >
                  次へ
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {editing && (
        <EditTransactionModal transaction={editing} onClose={() => setEditing(null)} onSaved={reload} />
      )}
    </div>
  );
}
