import { AssetGroup } from '@prisma/client';
import { prisma } from '../prisma';

export class AssetNotFoundError extends Error {}
export class AssetValidationError extends Error {}

async function assertOwnerUserInHousehold(householdId: bigint, ownerUserId: bigint) {
  const user = await prisma.user.findFirst({ where: { id: ownerUserId, householdId } });
  if (!user) {
    throw new AssetValidationError('ownerUserIdが不正です');
  }
}

export async function listAssets(householdId: bigint, assetGroup?: AssetGroup) {
  return prisma.asset.findMany({
    where: { householdId, ...(assetGroup ? { assetGroup } : {}) },
    orderBy: { sortOrder: 'asc' },
  });
}

export interface CreateAssetInput {
  assetGroup: AssetGroup;
  name: string;
  detail?: string | null;
  ownerUserId: bigint;
  purpose?: string | null;
  monthlyContribution?: number | null;
  memo?: string | null;
  sortOrder?: number;
}

export async function createAsset(householdId: bigint, data: CreateAssetInput) {
  await assertOwnerUserInHousehold(householdId, data.ownerUserId);
  return prisma.asset.create({
    data: {
      householdId,
      assetGroup: data.assetGroup,
      name: data.name,
      detail: data.detail ?? null,
      ownerUserId: data.ownerUserId,
      purpose: data.purpose ?? null,
      monthlyContribution: data.monthlyContribution ?? null,
      memo: data.memo ?? null,
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

export interface UpdateAssetInput {
  name?: string;
  detail?: string | null;
  ownerUserId?: bigint;
  purpose?: string | null;
  monthlyContribution?: number | null;
  memo?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export async function updateAsset(householdId: bigint, id: bigint, data: UpdateAssetInput) {
  const existing = await prisma.asset.findFirst({ where: { id, householdId } });
  if (!existing) {
    throw new AssetNotFoundError('資産が見つかりません');
  }
  if (data.ownerUserId !== undefined) {
    await assertOwnerUserInHousehold(householdId, data.ownerUserId);
  }
  const after = await prisma.asset.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.detail !== undefined ? { detail: data.detail } : {}),
      ...(data.ownerUserId !== undefined ? { ownerUserId: data.ownerUserId } : {}),
      ...(data.purpose !== undefined ? { purpose: data.purpose } : {}),
      ...(data.monthlyContribution !== undefined
        ? { monthlyContribution: data.monthlyContribution }
        : {}),
      ...(data.memo !== undefined ? { memo: data.memo } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });
  return { before: existing, after };
}
