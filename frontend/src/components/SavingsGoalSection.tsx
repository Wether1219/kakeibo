import { FormEvent, useEffect, useState } from 'react';
import {
  SavingsGoal,
  createSavingsGoal,
  deactivateSavingsGoal,
  fetchSavingsGoals,
} from '../api/savingsGoals';

interface Props {
  // 選択中の年における世帯全体の貯金実績（年間収支可視化の集計を流用、API追加なし）。
  actualSaving: number;
}

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

export function SavingsGoalSection({ actualSaving }: Props) {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetchSavingsGoals()
      .then(setGoals)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || targetAmount === '' || targetAmount < 1) return;
    setSaving(true);
    setError(null);
    try {
      await createSavingsGoal(name.trim(), targetAmount);
      setName('');
      setTargetAmount('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (goal: SavingsGoal) => {
    if (!window.confirm(`「${goal.name}」を削除しますか？`)) return;
    try {
      await deactivateSavingsGoal(goal.id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section>
      <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2">貯金目標</h2>
      <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-4">
        {loading && <p className="text-sm text-gray-400 dark:text-gray-500">読み込み中...</p>}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {!loading &&
          goals.map((goal) => {
            const ratio = goal.targetAmount > 0 ? (actualSaving / goal.targetAmount) * 100 : 0;
            const achieved = actualSaving >= goal.targetAmount;
            return (
              <div key={goal.id}>
                <div className="flex justify-between items-center text-sm mb-1">
                  <span className="flex items-center gap-1">
                    {goal.name}
                    {achieved && (
                      <span className="text-[10px] font-bold text-white bg-green-500 rounded px-1.5 py-0.5">
                        達成
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={achieved ? 'text-green-700 dark:text-green-400 font-bold' : 'text-gray-600 dark:text-gray-400'}>
                      {formatYen(actualSaving)}/{formatYen(goal.targetAmount)}（{ratio.toFixed(0)}%）
                    </span>
                    <button
                      type="button"
                      className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                      onClick={() => handleDelete(goal)}
                    >
                      削除
                    </button>
                  </span>
                </div>
                <div className="h-2 rounded bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div
                    className={`h-full ${achieved ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(100, Math.max(0, ratio))}%` }}
                  />
                </div>
              </div>
            );
          })}
        {!loading && goals.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500">貯金目標が設定されていません</p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end pt-2 border-t border-gray-100 dark:border-gray-700">
          <div className="flex-1 min-w-[8rem]">
            <label className="block text-xs text-gray-500 dark:text-gray-400">目標名</label>
            <input
              className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1 text-sm"
              value={name}
              placeholder="例：旅行資金"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400">目標額</label>
            <input
              type="number"
              min={1}
              className="w-28 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1 text-sm text-right"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white rounded px-4 py-1.5 text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            追加
          </button>
        </form>
      </div>
    </section>
  );
}
