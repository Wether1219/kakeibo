import { useEffect, useState } from 'react';
import { MonthlySettlement, fetchMonthlySettlement } from '../api/settlements';

export interface MonthlySettlementData {
  settlement: MonthlySettlement | null;
  loading: boolean;
  error: string | null;
}

export function useMonthlySettlement(year: number, month: number): MonthlySettlementData {
  const [settlement, setSettlement] = useState<MonthlySettlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchMonthlySettlement(year, month)
      .then((res) => {
        if (cancelled) return;
        setSettlement(res);
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

  return { settlement, loading, error };
}
