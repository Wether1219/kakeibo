import express from 'express';
import { authRouter } from './routes/auth';
import { categoriesRouter } from './routes/categories';
import { importRouter } from './routes/import';
import { transactionsRouter } from './routes/transactions';
import { incomesRouter } from './routes/incomes';
import { preSavingsRouter } from './routes/preSavings';
import { usersRouter } from './routes/users';
import { summaryRouter } from './routes/summary';
import { weeklyBudgetsRouter } from './routes/weeklyBudgets';
import { auditLogsRouter } from './routes/auditLogs';
import { exportRouter } from './routes/export';
import { assetsRouter } from './routes/assets';
import { assetBalancesRouter } from './routes/assetBalances';
import { recurringTransactionsRouter } from './routes/recurringTransactions';
import { savingsGoalsRouter } from './routes/savingsGoals';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/categories', categoriesRouter);
  app.use('/api/v1/transactions', transactionsRouter);
  app.use('/api/v1/incomes', incomesRouter);
  app.use('/api/v1/pre-savings', preSavingsRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/summary', summaryRouter);
  app.use('/api/v1/weekly-budgets', weeklyBudgetsRouter);
  app.use('/api/v1/audit-logs', auditLogsRouter);
  app.use('/api/v1/export', exportRouter);
  app.use('/api/v1/assets', assetsRouter);
  app.use('/api/v1/asset-balances', assetBalancesRouter);
  app.use('/api/v1/import', importRouter);
  app.use('/api/v1/recurring-transactions', recurringTransactionsRouter);
  app.use('/api/v1/savings-goals', savingsGoalsRouter);
  return app;
}
