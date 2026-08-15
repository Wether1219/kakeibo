import { useEffect, useState } from 'react';
import { fetchSettlementSummary, SettlementSummary } from '../api/summary';

export interface SettlementSummaryData {
  summary: SettlementSummary | null;
  loading: boolean;
  error: string | null;
}

export function useSettlementSummary(startDate: string, endDate: string): SettlementSummaryData {
  const [summary, setSummary] = useState<SettlementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSettlementSummary(startDate, endDate)
      .then((res) => {
        if (cancelled) return;
        setSummary(res);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  return { summary, loading, error };
}
