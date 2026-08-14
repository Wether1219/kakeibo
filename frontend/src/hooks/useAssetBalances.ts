import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AssetBalanceSummary,
  bulkUpdateAssetBalances,
  fetchAssetBalances,
} from '../api/assetBalances';

const DEBOUNCE_MS = 500;

function cellKey(assetId: string, month: number): string {
  return `${assetId}:${month}`;
}

export function useAssetBalances(year: number) {
  const [summary, setSummary] = useState<AssetBalanceSummary>({
    assets: [],
    ownerSubtotals: [],
    total: new Array(12).fill(0),
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetchAssetBalances(year)
      .then((res) => setSummary(res))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [year]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return () => {
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current.clear();
    };
  }, [year]);

  const updateBalance = useCallback(
    (assetId: string, month: number, value: number) => {
      setSummary((prev) => ({
        ...prev,
        assets: prev.assets.map((asset) =>
          asset.assetId === assetId
            ? {
                ...asset,
                months: asset.months.map((amount, idx) => (idx === month - 1 ? value : amount)),
              }
            : asset
        ),
      }));

      const key = cellKey(assetId, month);
      const existingTimer = timers.current.get(key);
      if (existingTimer) clearTimeout(existingTimer);

      setSavingCells((prev) => new Set(prev).add(key));

      const timer = setTimeout(async () => {
        timers.current.delete(key);
        try {
          await bulkUpdateAssetBalances([{ assetId, year, month, balance: value }]);
          await load();
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setSavingCells((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }
      }, DEBOUNCE_MS);
      timers.current.set(key, timer);
    },
    [year, load]
  );

  const isSaving = useCallback(
    (assetId: string, month: number) => savingCells.has(cellKey(assetId, month)),
    [savingCells]
  );

  return { summary, loading, error, updateBalance, isSaving, reload: load };
}
