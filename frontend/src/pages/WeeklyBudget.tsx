import { useState } from 'react';
import { useWeeklyBudgetForm } from '../hooks/useWeeklyBudgetForm';
import { useYearMonthParams } from '../hooks/useYearMonthParams';
import { WeeklyBudgetGrid } from '../components/WeeklyBudgetGrid';
import { ErrorMessage, LoadingMessage } from '../components/StatusMessage';

export function WeeklyBudget() {
  const { year, month, setYearMonth } = useYearMonthParams();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const { categories, weeks, budgets, actuals, suggestedCells, loading, saving, error, setBudget, save } =
    useWeeklyBudgetForm(year, month);

  const handleSave = async () => {
    setSaveMessage(null);
    try {
      await save();
      setSaveMessage('保存しました');
    } catch {
      // エラーはuseWeeklyBudgetFormのerrorステートで表示される
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">週次予算設定</h1>

      <div className="flex items-end gap-2 mb-6">
        <div>
          <label htmlFor="weekly-budget-year" className="block text-xs text-gray-500 dark:text-gray-400">年</label>
          <input
            id="weekly-budget-year"
            type="number"
            className="w-24 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1"
            value={year}
            onChange={(e) => setYearMonth(Number(e.target.value), month)}
          />
        </div>
        <div>
          <label htmlFor="weekly-budget-month" className="block text-xs text-gray-500 dark:text-gray-400">月</label>
          <select
            id="weekly-budget-month"
            className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1"
            value={month}
            onChange={(e) => setYearMonth(year, Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}月
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <LoadingMessage />}
      {error && <ErrorMessage className="mb-4">{error}</ErrorMessage>}

      {!loading && (
        <>
          <section className="mb-8">
            <WeeklyBudgetGrid
              categories={categories}
              weeks={weeks}
              budgets={budgets}
              actuals={actuals}
              suggestedCells={suggestedCells}
              onBudgetChange={setBudget}
            />
            {suggestedCells.size > 0 && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                黄色背景の予算は前月までの実績から自動算出した金額です（未保存。編集・保存できます）
              </p>
            )}
          </section>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 text-white rounded px-4 py-1.5 hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
            {saveMessage && <span className="text-sm text-green-600 dark:text-green-400">{saveMessage}</span>}
          </div>
        </>
      )}
    </div>
  );
}
