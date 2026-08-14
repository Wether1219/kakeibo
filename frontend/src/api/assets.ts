import { apiFetch } from './client';

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

export async function fetchAssets(assetGroup?: AssetGroup): Promise<Asset[]> {
  const query = assetGroup ? `?assetGroup=${assetGroup}` : '';
  const res = await apiFetch(`/assets${query}`);
  if (!res.ok) throw new Error('資産一覧の取得に失敗しました');
  return res.json();
}

export async function createAsset(input: CreateAssetInput): Promise<Asset> {
  const res = await apiFetch('/assets', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('口座の追加に失敗しました');
  return res.json();
}

export async function deactivateAsset(id: string): Promise<Asset> {
  const res = await apiFetch(`/assets/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ isActive: false }),
  });
  if (!res.ok) throw new Error('口座の削除に失敗しました');
  return res.json();
}
