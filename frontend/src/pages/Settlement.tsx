import { MonthSelector } from '../components/MonthSelector';
import { SettlementBreakdownTable } from '../components/SettlementBreakdownTable';
import { SettlementResultCard } from '../components/SettlementResultCard';
import { useYearMonthParams } from '../hooks/useYearMonthParams';
import { useSettlementSummary } from '../hooks/useSettlementSummary';
import { ErrorMessage, LoadingMessage } from '../components/StatusMessage';

export function Settlement() {
  const { year, month, setYearMonth } = useYearMonthParams();
  const { summary, loading, error } = useSettlementSummary(year, month);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <h1 className="text-xl font-bold text-center">精算</h1>
      <MonthSelector year={year} month={month} onChange={setYearMonth} />

      {loading && <LoadingMessage className="text-center" />}
      {error && <ErrorMessage className="text-center">{error}</ErrorMessage>}

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
