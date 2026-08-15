import { useState } from 'react';
import { useIncomeAndPreSavingForm } from '../hooks/useIncomeAndPreSavingForm';
import { IncomeGrid } from '../components/IncomeGrid';
import { PreSavingGrid } from '../components/PreSavingGrid';
import { ErrorMessage, LoadingMessage } from '../components/StatusMessage';

const now = new Date();

export function IncomeAndPreSaving() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const {
    users,
    incomeCategories,
    preSavingCategories,
    incomeValues,
    preSavingBudgets,
    preSavingActuals,
    loading,
    saving,
    error,
    setIncomeAmount,
    setPreSavingBudget,
    setPreSavingActual,
    save,
  } = useIncomeAndPreSavingForm(year, month);

  const handleSave = async () => {
    setSaveMessage(null);
    try {
      await save();
      setSaveMessage('保存しました');
    } catch {
      // エラーはuseIncomeAndPreSavingFormのerrorステートで表示される
    }
  };

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
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </div>
        <div>
          <label htmlFor="income-month" className="block text-xs text-gray-500 dark:text-gray-400">月</label>
          <select
            id="income-month"
            className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
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
              onBudgetChange={setPreSavingBudget}
              onActualChange={setPreSavingActual}
            />
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
