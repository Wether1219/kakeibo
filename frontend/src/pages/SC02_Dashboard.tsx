import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BalanceSummaryCard } from '../components/BalanceSummaryCard';
import { ExpensePieCharts } from '../components/ExpensePieCharts';
import { MonthSelector } from '../components/MonthSelector';
import { RecentTransactions } from '../components/RecentTransactions';
import { WeeklyBudgetProgress } from '../components/WeeklyBudgetProgress';
import { useDashboard } from '../hooks/useDashboard';
import { useYearMonthParams } from '../hooks/useYearMonthParams';

export function SC02_Dashboard() {
  const { year, month, setYearMonth } = useYearMonthParams();
  const navigate = useNavigate();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { summary, weeklyBudgets, recentTransactions, categories, users, loading, error, removeTransaction } =
    useDashboard(year, month);

  const handleChangeMonth = (nextYear: number, nextMonth: number) => {
    setYearMonth(nextYear, nextMonth);
  };

  const handleDeleteTransaction = async (id: string) => {
    setDeleteError(null);
    try {
      await removeTransaction(id);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <MonthSelector year={year} month={month} onChange={handleChangeMonth} />

      {loading && <p className="text-sm text-gray-400 dark:text-gray-500">読み込み中...</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {deleteError && <p className="text-sm text-red-600 dark:text-red-400">{deleteError}</p>}

      {!loading && summary && (
        <>
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {summary.members.map((m) => (
              <BalanceSummaryCard
                key={m.userId}
                displayName={m.displayName}
                income={m.income}
                preSaving={m.preSaving}
                expense={m.expense}
                remainingSaving={m.remainingSaving}
                totalSaving={m.totalSaving}
              />
            ))}
          </section>

          <ExpensePieCharts
            members={summary.members}
            fixedExpenseByCategory={summary.fixedExpenseByCategory}
            variableExpenseByCategory={summary.variableExpenseByCategory}
          />

          <WeeklyBudgetProgress rows={weeklyBudgets} />

          <RecentTransactions
            transactions={recentTransactions}
            categories={categories}
            users={users}
            onDelete={handleDeleteTransaction}
            onShowMore={() => navigate(`/transactions?year=${year}&month=${month}`)}
          />
        </>
      )}
    </div>
  );
}
