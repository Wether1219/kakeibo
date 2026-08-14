import { FormEvent, useEffect, useState } from 'react';
import { Category, fetchCategories } from '../api/categories';
import { User, fetchUsers } from '../api/users';
import {
  RecurringTransaction,
  createRecurringTransaction,
  deactivateRecurringTransaction,
  fetchRecurringTransactions,
} from '../api/recurringTransactions';

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

// SC11「定期取引」タブの中身。毎月自動で発生する取引（家賃・サブスク等）のテンプレートを
// 登録・一覧・無効化する。実際の取引への反映は、当月をダッシュボードで表示したタイミングで
// バックエンドが自動生成する（フロントからの明示的な実行操作は不要）。
export function RecurringTransactionsPanel() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [recurrences, setRecurrences] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState('');
  const [targetKey, setTargetKey] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [memo, setMemo] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState<number | ''>(1);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchCategories('fixed_expense'),
      fetchCategories('variable_expense'),
      fetchUsers(),
      fetchRecurringTransactions(),
    ])
      .then(([fixedCats, variableCats, userList, recurrenceList]) => {
        const activeCategories = [...variableCats, ...fixedCats].filter((c) => c.isActive);
        setCategories(activeCategories);
        setUsers(userList);
        setRecurrences(recurrenceList.filter((r) => r.isActive));
        setCategoryId((prev) => prev || activeCategories[0]?.id || '');
        setTargetKey((prev) => prev || userList[0]?.id || '');
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const userMap = new Map(users.map((u) => [u.id, u]));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!categoryId || !targetKey || amount === '' || amount < 1 || dayOfMonth === '') {
      setFormError('全ての項目を入力してください');
      return;
    }
    setSaving(true);
    try {
      await createRecurringTransaction({
        categoryId,
        splitType: targetKey === 'shared' ? 'shared' : 'self',
        userId: targetKey === 'shared' ? null : targetKey,
        amount,
        memo: memo.trim() || null,
        dayOfMonth,
      });
      setAmount('');
      setMemo('');
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (r: RecurringTransaction) => {
    if (!window.confirm('この定期取引を無効化しますか？（既に生成済みの取引は削除されません）')) return;
    try {
      await deactivateRecurringTransaction(r.id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading) return <p className="text-sm text-gray-400 dark:text-gray-500">読み込み中...</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        毎月自動で発生する取引（家賃・サブスク等）を登録できます。登録した費目は、その月をダッシュボードで表示したタイミングで自動的に取引として追加されます。
      </p>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end border-b border-gray-100 dark:border-gray-700 pb-4">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400">費目</label>
          <select
            className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ?? ''} {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400">対象者</label>
          <select
            className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1"
            value={targetKey}
            onChange={(e) => setTargetKey(e.target.value)}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
            <option value="shared">両方</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400">金額</label>
          <input
            type="number"
            min={1}
            className="w-24 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1 text-right"
            value={amount}
            onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400">毎月</label>
          <input
            type="number"
            min={1}
            max={28}
            className="w-16 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1 text-right"
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value === '' ? '' : Number(e.target.value))}
          />
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">日</span>
        </div>
        <div className="flex-1 min-w-[8rem]">
          <label className="block text-xs text-gray-500 dark:text-gray-400">メモ</label>
          <input
            className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 text-white rounded px-4 py-1.5 hover:bg-blue-700 disabled:opacity-50"
        >
          追加
        </button>
      </form>
      {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}

      <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
        {recurrences.length === 0 && (
          <p className="px-4 py-4 text-sm text-gray-400 dark:text-gray-500">登録済みの定期取引はありません</p>
        )}
        {recurrences.map((r) => {
          const category = categoryMap.get(r.categoryId);
          const targetName = r.splitType === 'shared' ? '両方' : userMap.get(r.userId ?? '')?.displayName ?? '-';
          return (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="w-28 shrink-0 truncate">
                {category?.icon ?? ''}
                {category?.name ?? ''}
              </span>
              <span className="w-16 shrink-0 text-gray-500 dark:text-gray-400">{targetName}</span>
              <span className="w-20 shrink-0 text-right font-medium">{formatYen(r.amount)}</span>
              <span className="w-14 shrink-0 text-gray-500 dark:text-gray-400">毎月{r.dayOfMonth}日</span>
              <span className="flex-1 truncate text-gray-500 dark:text-gray-400">{r.memo}</span>
              <button
                type="button"
                className="shrink-0 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                onClick={() => handleDeactivate(r)}
              >
                無効化
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
