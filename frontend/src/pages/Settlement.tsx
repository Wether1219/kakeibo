import { MonthSelector } from '../components/MonthSelector';
import { SettlementBreakdownTable } from '../components/SettlementBreakdownTable';
import { SettlementResultCard } from '../components/SettlementResultCard';
import { useYearMonthParams } from '../hooks/useYearMonthParams';
import { useSettlementSummary } from '../hooks/useSettlementSummary';

export function Settlement() {
  const { year, month, setYearMonth } = useYearMonthParams();
  const { summary, loading, error } = useSettlementSummary(year, month);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <h1 className="text-xl font-bold text-center">精算</h1>
      <MonthSelector year={year} month={month} onChange={setYearMonth} />

      {loading && <p className="text-sm text-center text-gray-400 dark:text-gray-500">読み込み中...</p>}
      {error && <p className="text-sm text-center text-red-600 dark:text-red-400">{error}</p>}

      {summary && !loading && !error && (
        <>
          <SettlementResultCard
            direction={summary.direction}
            amount={summary.amount}
            fromUser={summary.fromUser}
            toUser={summary.toUser}
          />
          <SettlementBreakdownTable breakdown={summary.breakdown} />
        </>
      )}
    </div>
  );
}
