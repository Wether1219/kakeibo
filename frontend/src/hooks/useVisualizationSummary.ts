import { useEffect, useState } from 'react';
import { fetchVisualizationSummary, VisualizationMember } from '../api/summary';

export interface VisualizationSummaryData {
  members: VisualizationMember[];
  loading: boolean;
  error: string | null;
}

export function useVisualizationSummary(year: number): VisualizationSummaryData {
  const [members, setMembers] = useState<VisualizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchVisualizationSummary(year)
      .then((res) => {
        if (cancelled) return;
        setMembers(res.members);
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

  return { members, loading, error };
}
