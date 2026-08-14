import { prisma } from '../prisma';

export class AssetBalanceValidationError extends Error {}

export interface AssetBalanceInput {
  assetId: bigint;
  year: number;
  month: number;
  balance: number;
}

function validateInput(data: AssetBalanceInput) {
  if (!Number.isInteger(data.year) || data.year < 2000 || data.year > 2100) {
    throw new AssetBalanceValidationError('yearが不正です');
  }
  if (!Number.isInteger(data.month) || data.month < 1 || data.month > 12) {
    throw new AssetBalanceValidationError('monthは1〜12の整数である必要があります');
  }
  if (!Number.isInteger(data.balance)) {
    throw new AssetBalanceValidationError('balanceは整数である必要があります');
  }
}

function assetBalanceKey(i: { assetId: bigint; year: number; month: number }) {
  return `${i.assetId}:${i.year}:${i.month}`;
}

// 監査ログのbefore/after記録のため、upsert前の既存行をまとめて取得し結果と対にして返す
export async function bulkUpsertAssetBalances(householdId: bigint, items: AssetBalanceInput[]) {
  items.forEach(validateInput);

  const assetIds = Array.from(new Set(items.map((item) => item.assetId)));
  const assets =
    assetIds.length === 0
      ? []
      : await prisma.asset.findMany({ where: { id: { in: assetIds }, householdId } });
  const validAssetIds = new Set(assets.map((a) => a.id));
  for (const item of items) {
    if (!validAssetIds.has(item.assetId)) {
      throw new AssetBalanceValidationError('assetIdが不正です');
    }
  }

  const existingRows =
    items.length === 0
      ? []
      : await prisma.assetBalance.findMany({
          where: {
            OR: items.map((item) => ({
              assetId: item.assetId,
              year: item.year,
              month: item.month,
            })),
          },
        });
  const existingMap = new Map(existingRows.map((row) => [assetBalanceKey(row), row]));

  const results = await prisma.$transaction(
    items.map((item) =>
      prisma.assetBalance.upsert({
        where: {
          assetId_year_month: {
            assetId: item.assetId,
            year: item.year,
            month: item.month,
          },
        },
        update: { balance: item.balance },
        create: {
          assetId: item.assetId,
          year: item.year,
          month: item.month,
          balance: item.balance,
        },
      })
    )
  );

  return results.map((result, idx) => ({
    result,
    before: existingMap.get(assetBalanceKey(items[idx])) ?? null,
  }));
}

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

// 世帯内の全資産×1〜12月の残高一覧に、名義人別小計・世帯合計を加えて返す（SC09のテーブル下部の集計行に対応）
export async function listAssetBalances(
  householdId: bigint,
  year: number
): Promise<AssetBalanceSummary> {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new AssetBalanceValidationError('yearが不正です');
  }

  const [assets, users, balances] = await Promise.all([
    prisma.asset.findMany({
      where: { householdId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.user.findMany({ where: { householdId } }),
    prisma.assetBalance.findMany({
      where: { year, asset: { householdId } },
    }),
  ]);

  const balanceMap = new Map<string, number>();
  for (const b of balances) {
    balanceMap.set(`${b.assetId}:${b.month}`, Number(b.balance));
  }

  const assetRows: AssetBalanceRow[] = assets.map((asset) => {
    const months: number[] = [];
    for (let month = 1; month <= 12; month++) {
      months.push(balanceMap.get(`${asset.id}:${month}`) ?? 0);
    }
    return {
      assetId: asset.id.toString(),
      assetGroup: asset.assetGroup,
      assetName: asset.name,
      ownerUserId: asset.ownerUserId.toString(),
      months,
    };
  });

  const ownerSubtotals: OwnerSubtotalRow[] = users.map((user) => {
    const months = new Array(12).fill(0);
    for (const row of assetRows) {
      if (row.ownerUserId === user.id.toString()) {
        row.months.forEach((amount, idx) => {
          months[idx] += amount;
        });
      }
    }
    return { ownerUserId: user.id.toString(), displayName: user.displayName, months };
  });

  const total = new Array(12).fill(0);
  for (const row of ownerSubtotals) {
    row.months.forEach((amount, idx) => {
      total[idx] += amount;
    });
  }

  return { assets: assetRows, ownerSubtotals, total };
}
