import { useEffect, useState } from 'react';
import { fetchSettlementSummary, SettlementSummary } from '../api/summary';

export interface SettlementSummaryData {
  summary: SettlementSummary | null;
  loading: boolean;
  error: string | null;
}

export function useSettlementSummary(year: number, month: number): SettlementSummaryData {
  const [summary, setSummary] = useState<SettlementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSettlementSummary(year, month)
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
  }, [year, month]);

  return { summary, loading, error };
}
