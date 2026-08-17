import { MonthSelector } from '../components/MonthSelector';
import { SettlementBreakdownTable } from '../components/SettlementBreakdownTable';
import { SettlementResultCard } from '../components/SettlementResultCard';
import { useYearMonthParams } from '../hooks/useYearMonthParams';
import { useMonthlySettlement } from '../hooks/useMonthlySettlement';
import { ErrorMessage, LoadingMessage } from '../components/StatusMessage';

export function Settlement() {
  const { year, month, setYearMonth } = useYearMonthParams();
  const { settlement, loading, error } = useMonthlySettlement(year, month);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <h1 className="text-xl font-bold text-center">精算</h1>
      <MonthSelector year={year} month={month} onChange={setYearMonth} />

      {loading && <LoadingMessage className="text-center" />}
      {error && <ErrorMessage className="text-center">{error}</ErrorMessage>}

      {settlement && !loading && !error && (
        <>
          <SettlementResultCard
            direction={settlement.direction}
            amount={settlement.amount}
            fromUser={settlement.fromUser}
            toUser={settlement.toUser}
          />
          <SettlementBreakdownTable breakdown={settlement.breakdown} />
        </>
      )}
    </div>
  );
}
