import { FormEvent, useEffect, useState } from 'react';
import { Category, CategoryType, fetchCategories } from '../api/categories';
import { User, fetchUsers } from '../api/users';
import { Transaction, TransactionInput, updateTransaction } from '../api/transactions';

type ExpenseType = Extract<CategoryType, 'fixed_expense' | 'variable_expense'>;

const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  fixed_expense: '固定費',
  variable_expense: '変動費',
};

interface Props {
  transaction: Transaction;
  onClose: () => void;
  onSaved: () => void;
}

export function EditTransactionModal({ transaction, onClose, onSaved }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [expenseType, setExpenseType] = useState<ExpenseType>('variable_expense');
  const [categoryId, setCategoryId] = useState(transaction.categoryId);
  // 「両方」はshared、それ以外は対象ユーザーIDをそのまま保持する。
  const [targetKey, setTargetKey] = useState<string>(
    transaction.splitType === 'shared' ? 'shared' : transaction.userId ?? ''
  );
  const [transactionDate, setTransactionDate] = useState(transaction.transactionDate);
  const [amount, setAmount] = useState<number | ''>(transaction.amount);
  const [memo, setMemo] = useState(transaction.memo ?? '');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchCategories('fixed_expense'),
      fetchCategories('variable_expense'),
      fetchUsers(),
    ])
      .then(([fixedCats, variableCats, userList]) => {
        if (cancelled) return;
        // 編集対象の費目が無効化済みでも選択肢に残しておく。
        const all = [...fixedCats, ...variableCats].filter(
          (c) => c.isActive || c.id === transaction.categoryId
        );
        setCategories(all);
        setUsers(userList);
        const currentCategory = all.find((c) => c.id === transaction.categoryId);
        if (currentCategory) {
          setExpenseType(currentCategory.type as ExpenseType);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [transaction.categoryId]);

  const categoriesForType = categories.filter((c) => c.type === expenseType);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!categoryId) {
      setError('費目を選択してください');
      return;
    }
    if (amount === '' || amount < 1) {
      setError('金額は1円以上で入力してください');
      return;
    }
    if (!targetKey) {
      setError('対象者を選択してください');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data: TransactionInput = {
        transactionDate,
        categoryId,
        splitType: targetKey === 'shared' ? 'shared' : 'self',
        userId: targetKey === 'shared' ? null : targetKey,
        amount,
        memo: memo.trim() || null,
      };
      await updateTransaction(transaction.id, data);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded shadow-lg w-full max-w-sm p-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">取引を編集</h2>
        {loading && <p className="text-sm text-gray-400 dark:text-gray-500">読み込み中...</p>}
        {!loading && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">区分</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(EXPENSE_TYPE_LABELS) as ExpenseType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setExpenseType(type)}
                    className={`py-2 rounded border text-sm font-bold ${
                      expenseType === type
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                        : 'border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {EXPENSE_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">費目</label>
              <select
                className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-2 text-base"
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

            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">対象者</label>
              <div className="grid grid-cols-3 gap-2">
                {users.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setTargetKey(u.id)}
                    className={`py-2 rounded border text-sm font-bold ${
                      targetKey === u.id
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                        : 'border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {u.displayName}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setTargetKey('shared')}
                  className={`py-2 rounded border text-sm font-bold ${
                    targetKey === 'shared'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                      : 'border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  両方
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">金額</label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-2 text-xl text-right"
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>

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

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                onClick={onClose}
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 text-white rounded px-4 py-1.5 hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
