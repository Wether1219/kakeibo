import { Router } from 'express';
import { HouseholdRequest, authMiddleware } from '../middlewares/household';
import {
  SummaryValidationError,
  getAnnualSummary,
  getMonthlySummary,
  getVisualizationSummary,
} from '../services/summaryService';

export const summaryRouter = Router();
summaryRouter.use(authMiddleware);

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

summaryRouter.get('/annual', async (req: HouseholdRequest, res) => {
  const { year } = req.query;
  if (!/^\d+$/.test(String(year ?? ''))) {
    res.status(400).json({ error: 'yearは必須です' });
    return;
  }
  try {
    const summary = await getAnnualSummary(req.householdId!, Number(year));
    res.json(summary);
  } catch (e) {
    if (e instanceof SummaryValidationError) {
      res.status(400).json({ error: e.message });
      return;
    }
    throw e;
  }
});

summaryRouter.get('/visualization', async (req: HouseholdRequest, res) => {
  const { year } = req.query;
  if (!/^\d+$/.test(String(year ?? ''))) {
    res.status(400).json({ error: 'yearは必須です' });
    return;
  }
  try {
    const summary = await getVisualizationSummary(req.householdId!, Number(year));
    res.json(summary);
  } catch (e) {
    if (e instanceof SummaryValidationError) {
      res.status(400).json({ error: e.message });
      return;
    }
    throw e;
  }
});
