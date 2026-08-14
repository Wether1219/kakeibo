import { apiFetch } from './client';

export interface AssetBalanceRow {
  assetId: string;
  assetGroup: string;
  assetName: string;
  ownerUserId: string;
  months: number[]; // index 0 = 1月, ..., index 11 = 12月
}

export interface OwnerSubtotalRow {
  ownerUserId: string;
  displayName: string;
  months: number[];
}

export interface AssetBalanceSummary {
  assets: AssetBalanceRow[];
  ownerSubtotals: OwnerSubtotalRow[];
  total: number[];
}

export interface AssetBalanceBulkItem {
  assetId: string;
  year: number;
  month: number;
  balance: number;
}

export async function fetchAssetBalances(year: number): Promise<AssetBalanceSummary> {
  const res = await apiFetch(`/asset-balances?year=${year}`);
  if (!res.ok) throw new Error('資産残高の取得に失敗しました');
  return res.json();
}

export async function bulkUpdateAssetBalances(items: AssetBalanceBulkItem[]): Promise<unknown> {
  const res = await apiFetch('/asset-balances/bulk', {
    method: 'PUT',
    body: JSON.stringify(items),
  });
  if (!res.ok) throw new Error('資産残高の保存に失敗しました');
  return res.json();
}
