import { useEffect, useState } from 'react';
import { AnnualSummaryRow, fetchAnnualSummary } from '../api/summary';

export interface AnnualSummaryData {
  rows: AnnualSummaryRow[];
  loading: boolean;
  error: string | null;
}

export function useAnnualSummary(year: number): AnnualSummaryData {
  const [rows, setRows] = useState<AnnualSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAnnualSummary(year)
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows);
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
  }, [year]);

  return { rows, loading, error };
}
