import { FormEvent, useState } from 'react';
import { useTransactionForm } from '../hooks/useTransactionForm';
import type { ExpenseType, TargetSelection } from '../hooks/useTransactionForm';

const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  fixed_expense: '固定費',
  variable_expense: '変動費',
};

// SC03（取引入力画面）：スマホでの入力を①区分→②費目→③対象者→④保存の4タップで完了させる
// （金額はテンキー入力のためタップ数にカウントしない、設計書3.1参照）
export function TransactionInput() {
  const {
    users,
    currentUserId,
    otherUser,
    selectCurrentUser,
    categoriesForType,
    loading,
    saving,
    error,
    expenseType,
    setExpenseType,
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

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">取引入力</h1>

      {users.length > 0 && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-gray-500">あなたは：</span>
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => selectCurrentUser(u.id)}
              className={`px-2 py-1 rounded border ${
                currentUserId === u.id
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-gray-300 text-gray-500'
              }`}
            >
              {u.displayName}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="text-sm text-gray-400">読み込み中...</p>}

      {!loading && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ①区分選択（1タップ） */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">区分</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(EXPENSE_TYPE_LABELS) as ExpenseType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setExpenseType(type)}
                  className={`py-2 rounded border text-sm font-bold ${
                    expenseType === type
                      ? 'border-blue-600 bg-blue-50 text-blue-600'
                      : 'border-gray-300 text-gray-500'
                  }`}
                >
                  {EXPENSE_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          {/* ②費目選択（1タップ、アイコン付きプルダウン） */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">費目</label>
            <select
              className="w-full border border-gray-300 rounded px-2 py-2 text-base"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categoriesForType.length === 0 && <option value="">費目がありません</option>}
              {categoriesForType.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon ?? ''} {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* ③対象者選択（1タップ、初期値は「自分」） */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">対象者</label>
            <div className="grid grid-cols-3 gap-2">
              {targetOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setTarget(opt.key)}
                  className={`py-2 rounded border text-sm font-bold ${
                    target === opt.key
                      ? 'border-blue-600 bg-blue-50 text-blue-600'
                      : 'border-gray-300 text-gray-500'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 金額（テンキー入力、タップ数にはカウントしない） */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">金額</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              className="w-full border border-gray-300 rounded px-2 py-2 text-2xl text-right"
              value={amount}
              placeholder="0"
              onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>

          <details className="text-sm">
            <summary className="text-gray-500 cursor-pointer select-none">
              日付・メモ（任意）
            </summary>
            <div className="mt-2 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">日付</label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded px-2 py-1"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">メモ</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-2 py-1"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                />
              </div>
            </div>
          </details>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* ④保存（1タップ） */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 text-white rounded py-3 text-lg font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
          {saveMessage && <p className="text-sm text-green-600 text-center">{saveMessage}</p>}
        </form>
      )}
    </div>
  );
}
