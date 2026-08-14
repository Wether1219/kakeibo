import { ensureCurrentUserId } from './users';

const API_BASE = '/api/v1';

// 認証実装までの暫定措置。フェーズ0でJWTベースのAPIクライアントに置き換える。
const TEMP_HOUSEHOLD_ID = '1';
// useTransactionForm.tsと同じキー（「自分」ユーザーの暫定選択）。
const CURRENT_USER_KEY = 'kakeibo_current_user_id';

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

function headers(userId?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-household-id': TEMP_HOUSEHOLD_ID,
  };
  const resolvedUserId = userId ?? localStorage.getItem(CURRENT_USER_KEY);
  if (resolvedUserId) {
    headers['x-user-id'] = resolvedUserId;
  }
  return headers;
}

export async function fetchAssetBalances(year: number): Promise<AssetBalanceSummary> {
  const res = await fetch(`${API_BASE}/asset-balances?year=${year}`, { headers: headers() });
  if (!res.ok) throw new Error('資産残高の取得に失敗しました');
  return res.json();
}

export async function bulkUpdateAssetBalances(items: AssetBalanceBulkItem[]): Promise<unknown> {
  const userId = await ensureCurrentUserId();
  const res = await fetch(`${API_BASE}/asset-balances/bulk`, {
    method: 'PUT',
    headers: headers(userId),
    body: JSON.stringify(items),
  });
  if (!res.ok) throw new Error('資産残高の保存に失敗しました');
  return res.json();
}
