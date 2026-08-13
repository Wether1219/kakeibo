import express from 'express';
import { categoriesRouter } from './routes/categories';
import { transactionsRouter } from './routes/transactions';
import { incomesRouter } from './routes/incomes';
import { preSavingsRouter } from './routes/preSavings';
import { usersRouter } from './routes/users';
import { summaryRouter } from './routes/summary';
import { weeklyBudgetsRouter } from './routes/weeklyBudgets';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/categories', categoriesRouter);
  app.use('/api/v1/transactions', transactionsRouter);
  app.use('/api/v1/incomes', incomesRouter);
  app.use('/api/v1/pre-savings', preSavingsRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/summary', summaryRouter);
  app.use('/api/v1/weekly-budgets', weeklyBudgetsRouter);
  return app;
}
