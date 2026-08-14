import { ensureCurrentUserId } from './users';

const API_BASE = '/api/v1';

// 認証実装までの暫定措置。フェーズ0でJWTベースのAPIクライアントに置き換える。
const TEMP_HOUSEHOLD_ID = '1';
// useTransactionForm.tsと同じキー（「自分」ユーザーの暫定選択）。
const CURRENT_USER_KEY = 'kakeibo_current_user_id';

export type AssetGroup = 'cash_deposit' | 'securities' | 'insurance';

export interface Asset {
  id: string;
  householdId: string;
  assetGroup: AssetGroup;
  name: string;
  detail: string | null;
  ownerUserId: string;
  purpose: string | null;
  monthlyContribution: number | null;
  memo: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface CreateAssetInput {
  assetGroup: AssetGroup;
  name: string;
  detail?: string | null;
  ownerUserId: string;
  purpose?: string | null;
  monthlyContribution?: number | null;
  memo?: string | null;
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

export async function fetchAssets(assetGroup?: AssetGroup): Promise<Asset[]> {
  const query = assetGroup ? `?assetGroup=${assetGroup}` : '';
  const res = await fetch(`${API_BASE}/assets${query}`, { headers: headers() });
  if (!res.ok) throw new Error('資産一覧の取得に失敗しました');
  return res.json();
}

export async function createAsset(input: CreateAssetInput): Promise<Asset> {
  const userId = await ensureCurrentUserId();
  const res = await fetch(`${API_BASE}/assets`, {
    method: 'POST',
    headers: headers(userId),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('口座の追加に失敗しました');
  return res.json();
}

export async function deactivateAsset(id: string): Promise<Asset> {
  const userId = await ensureCurrentUserId();
  const res = await fetch(`${API_BASE}/assets/${id}`, {
    method: 'PUT',
    headers: headers(userId),
    body: JSON.stringify({ isActive: false }),
  });
  if (!res.ok) throw new Error('口座の削除に失敗しました');
  return res.json();
}
