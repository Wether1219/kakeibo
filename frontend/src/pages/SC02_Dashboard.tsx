import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BalanceSummaryCard } from '../components/BalanceSummaryCard';
import { DashboardAlertBanner } from '../components/DashboardAlertBanner';
import { ExpensePieCharts } from '../components/ExpensePieCharts';
import { MonthSelector } from '../components/MonthSelector';
import { RecentTransactions } from '../components/RecentTransactions';
import { SettlementCard } from '../components/SettlementCard';
import { ErrorMessage, LoadingMessage } from '../components/StatusMessage';
import { WeeklyBudgetProgress, countOverBudgetCategories } from '../components/WeeklyBudgetProgress';
import { useDashboard } from '../hooks/useDashboard';
import { useMonthlySettlement } from '../hooks/useMonthlySettlement';
import { useYearMonthParams } from '../hooks/useYearMonthParams';

export function SC02_Dashboard() {
  const { year, month, setYearMonth } = useYearMonthParams();
  const navigate = useNavigate();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { summary, weeklyBudgets, recentTransactions, categories, users, loading, error, removeTransaction } =
    useDashboard(year, month);
  const { settlement, loading: settlementLoading, error: settlementError } = useMonthlySettlement(year, month);

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

      {!loading && !settlementLoading && (
        <DashboardAlertBanner
          year={year}
          month={month}
          overBudgetCount={countOverBudgetCategories(weeklyBudgets)}
          settlement={settlement}
        />
      )}

      {loading && <LoadingMessage />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {deleteError && <ErrorMessage>{deleteError}</ErrorMessage>}

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

          <SettlementCard settlement={settlement} loading={settlementLoading} error={settlementError} />

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
