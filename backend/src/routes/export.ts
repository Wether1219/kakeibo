import { Router } from 'express';
import { HouseholdRequest, authMiddleware } from '../middlewares/household';
import { exportHouseholdXlsx, exportTransactionsCsv } from '../services/exportService';

export const exportRouter = Router();
exportRouter.use(authMiddleware);

exportRouter.get('/', async (req: HouseholdRequest, res) => {
  const { format } = req.query;
  if (format !== 'csv' && format !== 'xlsx') {
    res.status(400).json({ error: 'formatはcsvまたはxlsxを指定してください' });
    return;
  }

  if (format === 'csv') {
    const csv = await exportTransactionsCsv(req.householdId!);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="kakeibo_export.csv"');
    res.send(csv);
    return;
  }

  const buffer = await exportHouseholdXlsx(req.householdId!);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', 'attachment; filename="kakeibo_export.xlsx"');
  res.send(buffer);
});
