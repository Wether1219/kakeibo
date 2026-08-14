import { apiFetch } from './client';

export interface MonthlySummaryMember {
  userId: string;
  displayName: string;
  income: number;
  preSaving: number;
  fixedExpense: number;
  variableExpense: number;
  expense: number;
  remainingSaving: number;
  totalSaving: number;
}

export interface MonthlySummaryCategoryRow {
  categoryId: string;
  icon: string | null;
  name: string;
  amounts: Record<string, number>;
}

export interface MonthlySummary {
  year: number;
  month: number;
  members: MonthlySummaryMember[];
  fixedExpenseByCategory: MonthlySummaryCategoryRow[];
  variableExpenseByCategory: MonthlySummaryCategoryRow[];
}

export async function fetchMonthlySummary(year: number, month: number): Promise<MonthlySummary> {
  const res = await apiFetch(`/summary/monthly?year=${year}&month=${month}`);
  if (!res.ok) throw new Error('収支サマリの取得に失敗しました');
  return res.json();
}

export type CategoryType = 'income' | 'pre_saving' | 'fixed_expense' | 'variable_expense';

export interface AnnualSummaryRow {
  categoryType: CategoryType;
  categoryName: string;
  userId: string;
  displayName: string;
  months: number[];
  annualTotal: number;
}

export interface AnnualSummary {
  year: number;
  rows: AnnualSummaryRow[];
}

export async function fetchAnnualSummary(year: number): Promise<AnnualSummary> {
  const res = await apiFetch(`/summary/annual?year=${year}`);
  if (!res.ok) throw new Error('年間推移データの取得に失敗しました');
  return res.json();
}

export interface VisualizationBalance {
  income: number;
  preSaving: number;
  expense: number;
  remainingSaving: number;
  totalSaving: number;
}

export interface VisualizationCategoryAmount {
  categoryId: string;
  icon: string | null;
  name: string;
  amount: number;
}

export interface VisualizationMonthlyAverageBalance {
  income: number;
  preSaving: number;
  fixedExpense: number;
  variableExpense: number;
  remainingSaving: number;
  totalSaving: number;
  incomeByCategory: VisualizationCategoryAmount[];
  preSavingByCategory: VisualizationCategoryAmount[];
  fixedExpenseByCategory: VisualizationCategoryAmount[];
  variableExpenseByCategory: VisualizationCategoryAmount[];
}

export interface VisualizationMonthlyRatio {
  month: number;
  expenseRatio: number;
  savingRatio: number;
}

export interface VisualizationMember {
  userId: string;
  displayName: string;
  monthlyAverage: VisualizationMonthlyAverageBalance;
  bonusAverage: number;
  annual: VisualizationBalance;
  expenseRatio: number;
  savingRatio: number;
  monthlyRatios: VisualizationMonthlyRatio[];
}

export interface VisualizationSummary {
  year: number;
  members: VisualizationMember[];
}

export async function fetchVisualizationSummary(year: number): Promise<VisualizationSummary> {
  const res = await apiFetch(`/summary/visualization?year=${year}`);
  if (!res.ok) throw new Error('収支可視化データの取得に失敗しました');
  return res.json();
}
