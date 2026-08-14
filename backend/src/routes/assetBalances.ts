import { Router } from 'express';
import { HouseholdRequest, authMiddleware } from '../middlewares/household';
import {
  AssetBalanceInput,
  AssetBalanceValidationError,
  bulkUpsertAssetBalances,
  listAssetBalances,
} from '../services/assetBalanceService';
import { recordAuditLogs } from '../services/auditLogService';

function isPositiveIntString(value: unknown): value is string {
  return typeof value === 'string' && /^\d+$/.test(value);
}

function serializeAssetBalance(assetBalance: {
  id: bigint;
  assetId: bigint;
  year: number;
  month: number;
  balance: { toString(): string };
}) {
  return {
    id: assetBalance.id.toString(),
    assetId: assetBalance.assetId.toString(),
    year: assetBalance.year,
    month: assetBalance.month,
    balance: Number(assetBalance.balance.toString()),
  };
}

function parseAssetBalanceItem(item: unknown): AssetBalanceInput | null {
  const { assetId, year, month, balance } = (item as Record<string, unknown>) ?? {};
  if (
    !isPositiveIntString(String(assetId)) ||
    typeof year !== 'number' ||
    typeof month !== 'number' ||
    typeof balance !== 'number'
  ) {
    return null;
  }
  return {
    assetId: BigInt(assetId as string | number),
    year,
    month,
    balance,
  };
}

export const assetBalancesRouter = Router();
assetBalancesRouter.use(authMiddleware);

assetBalancesRouter.get('/', async (req: HouseholdRequest, res) => {
  const { year } = req.query;
  if (!/^\d+$/.test(String(year ?? ''))) {
    res.status(400).json({ error: 'yearは必須です' });
    return;
  }
  try {
    const summary = await listAssetBalances(req.householdId!, Number(year));
    res.json(summary);
  } catch (e) {
    if (e instanceof AssetBalanceValidationError) {
      res.status(400).json({ error: e.message });
      return;
    }
    throw e;
  }
});

assetBalancesRouter.put('/bulk', async (req: HouseholdRequest, res) => {
  if (!Array.isArray(req.body)) {
    res.status(400).json({ error: 'リクエストボディは配列である必要があります' });
    return;
  }
  const items = req.body.map(parseAssetBalanceItem);
  if (items.some((item) => item === null)) {
    res.status(400).json({ error: 'assetId, year, month, balanceは必須です' });
    return;
  }
  try {
    const upserted = await bulkUpsertAssetBalances(
      req.householdId!,
      items as AssetBalanceInput[]
    );
    await recordAuditLogs(
      upserted.map(({ result, before }) => ({
        householdId: req.householdId!,
        userId: req.userId!,
        targetTable: 'asset_balances',
        targetId: result.id,
        action: before ? ('update' as const) : ('create' as const),
        diff: {
          before: before ? serializeAssetBalance(before) : undefined,
          after: serializeAssetBalance(result),
        },
      }))
    );
    res.json(upserted.map(({ result }) => serializeAssetBalance(result)));
  } catch (e) {
    if (e instanceof AssetBalanceValidationError) {
      res.status(400).json({ error: e.message });
      return;
    }
    throw e;
  }
});
