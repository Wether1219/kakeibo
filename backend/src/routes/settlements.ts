import { Router } from 'express';
import { HouseholdRequest, authMiddleware } from '../middlewares/household';
import { SettlementValidationError, getMonthlySettlement } from '../services/settlementService';

export const settlementsRouter = Router();
settlementsRouter.use(authMiddleware);

settlementsRouter.get('/', async (req: HouseholdRequest, res) => {
  const { year, month } = req.query;
  if (!/^\d+$/.test(String(year ?? '')) || !/^\d+$/.test(String(month ?? ''))) {
    res.status(400).json({ error: 'year・monthは必須です' });
    return;
  }
  try {
    const result = await getMonthlySettlement(req.householdId!, Number(year), Number(month));
    res.json(result);
  } catch (e) {
    if (e instanceof SettlementValidationError) {
      res.status(400).json({ error: e.message });
      return;
    }
    throw e;
  }
});
