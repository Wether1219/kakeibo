import { apiFetch } from './client';

export interface ImportSummary {
  categories: { createdCount: number; updatedCount: number };
  incomes: { importedCount: number };
  preSavings: { importedCount: number };
  transactions: { importedCount: number };
  weeklyBudgets: { importedCount: number };
}

export async function importExcel(file: File): Promise<ImportSummary> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiFetch('/import/excel', { method: 'POST', body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? 'インポートに失敗しました');
  }
  return res.json();
}
