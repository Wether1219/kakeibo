import { FormEvent, useState } from 'react';
import { useTransactionForm } from '../hooks/useTransactionForm';
import type { TargetSelection } from '../hooks/useTransactionForm';
import type { Category } from '../api/categories';
import { SettlementFormSection } from '../components/SettlementFormSection';

// SC03（取引入力画面）：スマホでの入力を①費目→②対象者→③保存の3タップで完了させる
// （金額はテンキー入力のためタップ数にカウントしない）。
// 取引データはcategoryIdのみで区分（固定費/変動費）が一意に定まるため、
// 区分選択ステップは廃止し、固定費・変動費を1つの費目選択グリッドにまとめている
// （設計書3.1の「2段階費目選択」から意図的に変更。要件定義書6章の3タップ以内を優先）。
export function TransactionInput() {
  const {
    users,
    currentUserId,
    otherUser,
    variableCategories,
    fixedCategories,
    loading,
    saving,
    error,
    categoryId,
    setCategoryId,
    target,
    setTarget,
    transactionDate,
    setTransactionDate,
    amount,
    setAmount,
    memo,
    setMemo,
    settlement,
    setSettlement,
    save,
  } = useTransactionForm();

  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const currentUser = users.find((u) => u.id === currentUserId) ?? null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaveMessage(null);
    try {
      await save();
      setSaveMessage('保存しました');
    } catch {
      // エラーはuseTransactionFormのerrorステートで表示される
    }
  };

  const targetOptions: { key: TargetSelection; label: string }[] = [
    { key: 'self', label: currentUser ? currentUser.displayName : '自分' },
    { key: 'other', label: otherUser ? otherUser.displayName : '相手' },
    { key: 'shared', label: '両方' },
  ];

  const renderCategoryGroup = (label: string, list: Category[]) =>
    list.length > 0 && (
      <div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{label}</p>
        <div className="grid grid-cols-3 gap-2">
          {list.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={`py-2 rounded border text-sm font-bold truncate ${
                categoryId === c.id
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                  : 'border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              {c.icon ?? ''} {c.name}
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">取引入力</h1>

      {loading && <p className="text-sm text-gray-400 dark:text-gray-500">読み込み中...</p>}

      {!loading && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ①費目選択（1タップ、固定費・変動費をまとめた1つのグリッド） */}
          <div className="space-y-3">
            <label className="block text-xs text-gray-500 dark:text-gray-400">費目</label>
            {variableCategories.length === 0 && fixedCategories.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500">費目がありません</p>
            )}
            {renderCategoryGroup('変動費', variableCategories)}
            {renderCategoryGroup('固定費', fixedCategories)}
          </div>

          {/* ②対象者選択（1タップ、初期値は「自分」） */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">対象者</label>
            <div className="grid grid-cols-3 gap-2">
              {targetOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setTarget(opt.key)}
                  className={`py-2 rounded border text-sm font-bold ${
                    target === opt.key
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                      : 'border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 金額（テンキー入力、タップ数にはカウントしない） */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">金額</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-2 text-2xl text-right"
              value={amount}
              placeholder="0"
              onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>

          <details className="text-sm">
            <summary className="text-gray-500 dark:text-gray-400 cursor-pointer select-none">
              日付・メモ（任意）
            </summary>
            <div className="mt-2 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">日付</label>
                <input
                  type="date"
                  className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">メモ</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                />
              </div>
            </div>
          </details>

          <SettlementFormSection value={settlement} onChange={setSettlement} users={users} amount={amount} />

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          {/* ③保存（1タップ） */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 text-white rounded py-3 text-lg font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
          {saveMessage && <p className="text-sm text-green-600 dark:text-green-400 text-center">{saveMessage}</p>}
        </form>
      )}
    </div>
  );
}
