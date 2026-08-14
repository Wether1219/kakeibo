import { useState } from 'react';
import { BalanceSummaryCard } from '../components/BalanceSummaryCard';
import { ExpensePieCharts } from '../components/ExpensePieCharts';
import { MonthSelector } from '../components/MonthSelector';
import { RecentTransactions } from '../components/RecentTransactions';
import { WeeklyBudgetProgress } from '../components/WeeklyBudgetProgress';
import { useDashboard } from '../hooks/useDashboard';

// useTransactionForm.tsと同じキー（「自分」ユーザーの暫定選択。JWT認証実装時に置き換え）。
const CURRENT_USER_KEY = 'kakeibo_current_user_id';

const now = new Date();

export function SC02_Dashboard() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { summary, weeklyBudgets, recentTransactions, categories, users, loading, error, removeTransaction } =
    useDashboard(year, month);

  const handleChangeMonth = (nextYear: number, nextMonth: number) => {
    setYear(nextYear);
    setMonth(nextMonth);
  };

  const handleDeleteTransaction = async (id: string) => {
    const userId = localStorage.getItem(CURRENT_USER_KEY) ?? users[0]?.id;
    if (!userId) {
      setDeleteError('ユーザーが見つかりません');
      return;
    }
    setDeleteError(null);
    try {
      await removeTransaction(id, userId);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <MonthSelector year={year} month={month} onChange={handleChangeMonth} />

      {loading && <p className="text-sm text-gray-400">読み込み中...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}

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
          />
        </>
      )}
    </div>
  );
}
