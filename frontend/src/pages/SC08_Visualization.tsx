import { useState } from 'react';
import { AnnualBalanceSection } from '../components/AnnualBalanceSection';
import { AverageBalanceSection } from '../components/AverageBalanceSection';
import { KpiCards } from '../components/KpiCards';
import { RatioTrendChart } from '../components/RatioTrendChart';
import { YearSelector } from '../components/YearSelector';
import { useVisualizationSummary } from '../hooks/useVisualizationSummary';

export function SC08_Visualization() {
  const [year, setYear] = useState(new Date().getFullYear());
  const { members, loading, error } = useVisualizationSummary(year);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <YearSelector year={year} onChange={setYear} />

      {loading && <p className="text-sm text-gray-400">読み込み中...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <>
          <AverageBalanceSection members={members} />
          <AnnualBalanceSection members={members} />
          <KpiCards members={members} />
          <RatioTrendChart members={members} />
        </>
      )}
    </div>
  );
}
