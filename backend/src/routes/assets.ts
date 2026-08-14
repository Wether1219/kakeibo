import { Router } from 'express';
import { AssetGroup } from '@prisma/client';
import { HouseholdRequest, authMiddleware } from '../middlewares/household';
import {
  AssetNotFoundError,
  AssetValidationError,
  createAsset,
  listAssets,
  updateAsset,
} from '../services/assetService';
import { recordAuditLog } from '../services/auditLogService';

const ASSET_GROUPS = Object.values(AssetGroup);

function isAssetGroup(value: unknown): value is AssetGroup {
  return typeof value === 'string' && (ASSET_GROUPS as string[]).includes(value);
}

function isPositiveIntString(value: unknown): value is string {
  return typeof value === 'string' && /^\d+$/.test(value);
}

function serializeAsset(asset: {
  id: bigint;
  householdId: bigint;
  assetGroup: AssetGroup;
  name: string;
  detail: string | null;
  ownerUserId: bigint;
  purpose: string | null;
  monthlyContribution: { toString(): string } | null;
  memo: string | null;
  sortOrder: number;
  isActive: boolean;
}) {
  return {
    id: asset.id.toString(),
    householdId: asset.householdId.toString(),
    assetGroup: asset.assetGroup,
    name: asset.name,
    detail: asset.detail,
    ownerUserId: asset.ownerUserId.toString(),
    purpose: asset.purpose,
    monthlyContribution:
      asset.monthlyContribution !== null ? Number(asset.monthlyContribution.toString()) : null,
    memo: asset.memo,
    sortOrder: asset.sortOrder,
    isActive: asset.isActive,
  };
}

export const assetsRouter = Router();
assetsRouter.use(authMiddleware);

assetsRouter.get('/', async (req: HouseholdRequest, res) => {
  const groupParam = req.query.assetGroup;
  if (groupParam !== undefined && !isAssetGroup(groupParam)) {
    res.status(400).json({ error: 'assetGroupが不正です' });
    return;
  }
  const assets = await listAssets(req.householdId!, groupParam as AssetGroup | undefined);
  res.json(assets.map(serializeAsset));
});

assetsRouter.post('/', async (req: HouseholdRequest, res) => {
  const { assetGroup, name, detail, ownerUserId, purpose, monthlyContribution, memo, sortOrder } =
    req.body ?? {};
  if (
    !isAssetGroup(assetGroup) ||
    typeof name !== 'string' ||
    name.trim() === '' ||
    !isPositiveIntString(String(ownerUserId))
  ) {
    res.status(400).json({ error: 'assetGroup, name, ownerUserIdは必須です' });
    return;
  }
  try {
    const asset = await createAsset(req.householdId!, {
      assetGroup,
      name,
      detail,
      ownerUserId: BigInt(ownerUserId as string | number),
      purpose,
      monthlyContribution,
      memo,
      sortOrder,
    });
    await recordAuditLog({
      householdId: req.householdId!,
      userId: req.userId!,
      targetTable: 'assets',
      targetId: asset.id,
      action: 'create',
      diff: { after: serializeAsset(asset) },
    });
    res.status(201).json(serializeAsset(asset));
  } catch (e) {
    if (e instanceof AssetValidationError) {
      res.status(400).json({ error: e.message });
      return;
    }
    throw e;
  }
});

assetsRouter.put('/:id', async (req: HouseholdRequest, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    res.status(400).json({ error: 'idが不正です' });
    return;
  }
  const { name, detail, ownerUserId, purpose, monthlyContribution, memo, sortOrder, isActive } =
    req.body ?? {};
  if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
    res.status(400).json({ error: 'nameが不正です' });
    return;
  }
  if (ownerUserId !== undefined && !isPositiveIntString(String(ownerUserId))) {
    res.status(400).json({ error: 'ownerUserIdが不正です' });
    return;
  }
  if (sortOrder !== undefined && typeof sortOrder !== 'number') {
    res.status(400).json({ error: 'sortOrderが不正です' });
    return;
  }
  if (isActive !== undefined && typeof isActive !== 'boolean') {
    res.status(400).json({ error: 'isActiveが不正です' });
    return;
  }
  try {
    const { before, after } = await updateAsset(req.householdId!, BigInt(req.params.id), {
      name,
      detail,
      ownerUserId: ownerUserId !== undefined ? BigInt(ownerUserId as string | number) : undefined,
      purpose,
      monthlyContribution,
      memo,
      sortOrder,
      isActive,
    });
    await recordAuditLog({
      householdId: req.householdId!,
      userId: req.userId!,
      targetTable: 'assets',
      targetId: after.id,
      action: 'update',
      diff: { before: serializeAsset(before), after: serializeAsset(after) },
    });
    res.json(serializeAsset(after));
  } catch (e) {
    if (e instanceof AssetNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    if (e instanceof AssetValidationError) {
      res.status(400).json({ error: e.message });
      return;
    }
    throw e;
  }
});
