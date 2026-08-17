import { useWeeklyBudgetForm } from '../hooks/useWeeklyBudgetForm';
import { useYearMonthParams } from '../hooks/useYearMonthParams';
import { WeeklyBudgetGrid } from '../components/WeeklyBudgetGrid';
import { ErrorMessage, LoadingMessage } from '../components/StatusMessage';

export function WeeklyBudget() {
  const { year, month, setYearMonth } = useYearMonthParams();

  const { categories, weeks, budgets, actuals, suggestedCells, loading, error, setBudget, isSaving } =
    useWeeklyBudgetForm(year, month);

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
        <section className="mb-8">
          <WeeklyBudgetGrid
            categories={categories}
            weeks={weeks}
            budgets={budgets}
            actuals={actuals}
            suggestedCells={suggestedCells}
            isSaving={isSaving}
            onBudgetChange={setBudget}
          />
          {suggestedCells.size > 0 && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              黄色背景の予算は前月までの実績から自動算出した金額です（未編集。入力すると自動保存されます）
            </p>
          )}
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">入力内容は自動的に保存されます</p>
        </section>
      )}
    </div>
  );
}
