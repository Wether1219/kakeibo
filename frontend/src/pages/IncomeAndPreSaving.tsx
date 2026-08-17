import { useIncomeAndPreSavingForm } from '../hooks/useIncomeAndPreSavingForm';
import { useYearMonthParams } from '../hooks/useYearMonthParams';
import { IncomeGrid } from '../components/IncomeGrid';
import { PreSavingGrid } from '../components/PreSavingGrid';
import { ErrorMessage, LoadingMessage } from '../components/StatusMessage';

export function IncomeAndPreSaving() {
  const { year, month, setYearMonth } = useYearMonthParams();

  const {
    users,
    incomeCategories,
    preSavingCategories,
    incomeValues,
    preSavingBudgets,
    preSavingActuals,
    loading,
    error,
    setIncomeAmount,
    setPreSavingBudget,
    setPreSavingActual,
    isIncomeSaving,
    isPreSavingSaving,
  } = useIncomeAndPreSavingForm(year, month);

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">収入・先取り貯金入力</h1>

      <div className="flex items-end gap-2 mb-6">
        <div>
          <label htmlFor="income-year" className="block text-xs text-gray-500 dark:text-gray-400">年</label>
          <input
            id="income-year"
            type="number"
            className="w-24 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1"
            value={year}
            onChange={(e) => setYearMonth(Number(e.target.value), month)}
          />
        </div>
        <div>
          <label htmlFor="income-month" className="block text-xs text-gray-500 dark:text-gray-400">月</label>
          <select
            id="income-month"
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
            <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2">収入</h2>
            <IncomeGrid
              categories={incomeCategories}
              users={users}
              values={incomeValues}
              isSaving={isIncomeSaving}
              onChange={setIncomeAmount}
            />
          </section>

          <section className="mb-8">
            <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2">先取り貯金・投資</h2>
            <PreSavingGrid
              categories={preSavingCategories}
              users={users}
              budgets={preSavingBudgets}
              actuals={preSavingActuals}
              isSaving={isPreSavingSaving}
              onBudgetChange={setPreSavingBudget}
              onActualChange={setPreSavingActual}
            />
          </section>

          <p className="text-xs text-gray-400 dark:text-gray-500">入力内容は自動的に保存されます</p>
        </>
      )}
    </div>
  );
}
