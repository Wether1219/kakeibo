const API_BASE = '/api/v1';

// 認証実装までの暫定措置。フェーズ0でJWTベースのAPIクライアントに置き換える。
const TEMP_HOUSEHOLD_ID = '1';

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

function headers() {
  return {
    'Content-Type': 'application/json',
    'x-household-id': TEMP_HOUSEHOLD_ID,
  };
}

export async function fetchMonthlySummary(year: number, month: number): Promise<MonthlySummary> {
  const res = await fetch(`${API_BASE}/summary/monthly?year=${year}&month=${month}`, {
    headers: headers(),
  });
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
  const res = await fetch(`${API_BASE}/summary/annual?year=${year}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error('年間推移データの取得に失敗しました');
  return res.json();
}
