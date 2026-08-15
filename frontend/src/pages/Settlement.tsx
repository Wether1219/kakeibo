import { DateRangeSelector } from '../components/DateRangeSelector';
import { SettlementBreakdownTable } from '../components/SettlementBreakdownTable';
import { SettlementResultCard } from '../components/SettlementResultCard';
import { useDateRangeParams } from '../hooks/useDateRangeParams';
import { useSettlementSummary } from '../hooks/useSettlementSummary';

export function Settlement() {
  const { startDate, endDate, setDateRange } = useDateRangeParams();
  const { summary, loading, error } = useSettlementSummary(startDate, endDate);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <h1 className="text-xl font-bold text-center">精算</h1>
      <DateRangeSelector startDate={startDate} endDate={endDate} onChange={setDateRange} />

      {loading && <p className="text-sm text-center text-gray-400 dark:text-gray-500">読み込み中...</p>}
      {error && <p className="text-sm text-center text-red-600 dark:text-red-400">{error}</p>}

      {summary && !loading && !error && (
        <>
          <SettlementResultCard
            netAmount={summary.netAmount}
            fromDisplayName={summary.fromDisplayName}
            toDisplayName={summary.toDisplayName}
          />
          <SettlementBreakdownTable breakdown={summary.breakdown} />
        </>
      )}
    </div>
  );
}
