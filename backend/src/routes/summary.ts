import { Router } from 'express';
import { HouseholdRequest, householdMiddleware } from '../middlewares/household';
import { SummaryValidationError, getMonthlySummary } from '../services/summaryService';

export const summaryRouter = Router();
summaryRouter.use(householdMiddleware);

summaryRouter.get('/monthly', async (req: HouseholdRequest, res) => {
  const { year, month } = req.query;
  if (!/^\d+$/.test(String(year ?? '')) || !/^\d+$/.test(String(month ?? ''))) {
    res.status(400).json({ error: 'year・monthは必須です' });
    return;
  }
  try {
    const summary = await getMonthlySummary(req.householdId!, Number(year), Number(month));
    res.json(summary);
  } catch (e) {
    if (e instanceof SummaryValidationError) {
      res.status(400).json({ error: e.message });
      return;
    }
    throw e;
  }
});
