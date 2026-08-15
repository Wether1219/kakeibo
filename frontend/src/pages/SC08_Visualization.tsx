import { AnnualBalanceSection } from '../components/AnnualBalanceSection';
import { AverageBalanceSection } from '../components/AverageBalanceSection';
import { KpiCards } from '../components/KpiCards';
import { RatioTrendChart } from '../components/RatioTrendChart';
import { SavingsGoalSection } from '../components/SavingsGoalSection';
import { YearSelector } from '../components/YearSelector';
import { useVisualizationSummary } from '../hooks/useVisualizationSummary';
import { useYearParam } from '../hooks/useYearMonthParams';
import { ErrorMessage, LoadingMessage } from '../components/StatusMessage';

export function SC08_Visualization() {
  const [year, setYear] = useYearParam();
  const { members, loading, error } = useVisualizationSummary(year);
  const actualSaving = members.reduce((sum, m) => sum + m.annual.totalSaving, 0);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <YearSelector year={year} onChange={setYear} />

      {loading && <LoadingMessage />}
      {error && <ErrorMessage>{error}</ErrorMessage>}

      {!loading && !error && (
        <>
          <AverageBalanceSection members={members} />
          <AnnualBalanceSection members={members} />
          <KpiCards members={members} />
          <RatioTrendChart members={members} />
          <SavingsGoalSection actualSaving={actualSaving} />
        </>
      )}
    </div>
  );
}
