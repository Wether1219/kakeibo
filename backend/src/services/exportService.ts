import * as XLSX from 'xlsx';
import { prisma } from '../prisma';

export class ExportValidationError extends Error {}

const CATEGORY_TYPE_LABEL: Record<string, string> = {
  income: '収入',
  pre_saving: '先取り貯金',
  fixed_expense: '固定費',
  variable_expense: '変動費',
};

const SPLIT_TYPE_LABEL: Record<string, string> = {
  self: '本人',
  shared: '両方',
};

async function loadHouseholdData(householdId: bigint) {
  const [categories, users, transactions, incomes, preSavings, weeklyBudgets] = await Promise.all([
    prisma.category.findMany({ where: { householdId }, orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }] }),
    prisma.user.findMany({ where: { householdId } }),
    prisma.transaction.findMany({ where: { householdId }, orderBy: { transactionDate: 'asc' } }),
    prisma.income.findMany({
      where: { householdId },
      orderBy: [{ year: 'asc' }, { month: 'asc' }, { userId: 'asc' }, { categoryId: 'asc' }],
    }),
    prisma.preSaving.findMany({
      where: { householdId },
      orderBy: [{ year: 'asc' }, { month: 'asc' }, { userId: 'asc' }, { categoryId: 'asc' }],
    }),
    prisma.weeklyBudget.findMany({
      where: { householdId },
      orderBy: [{ year: 'asc' }, { month: 'asc' }, { weekNo: 'asc' }, { categoryId: 'asc' }],
    }),
  ]);

  const categoryMap = new Map(categories.map((c) => [c.id.toString(), c]));
  const userMap = new Map(users.map((u) => [u.id.toString(), u]));
  const categoryName = (id: bigint) => {
    const c = categoryMap.get(id.toString());
    return c ? `${c.icon ?? ''}${c.name}` : '';
  };
  const userName = (id: bigint | null) => (id === null ? '' : userMap.get(id.toString())?.displayName ?? '');

  return { categories, users, transactions, incomes, preSavings, weeklyBudgets, categoryName, userName };
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows: (string | number)[][]): string {
  // Excelでの文字化けを防ぐためUTF-8 BOMを付与する
  return '﻿' + rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

// CSVはシートを持てないため、最も粒度の細かい取引一覧のみを出力する
export async function exportTransactionsCsv(householdId: bigint): Promise<string> {
  const { transactions, categoryName, userName } = await loadHouseholdData(householdId);
  const header = ['日付', '費目', '対象者', '金額', 'メモ'];
  const rows = transactions.map((t) => [
    toDateString(t.transactionDate),
    categoryName(t.categoryId),
    t.splitType === 'shared' ? SPLIT_TYPE_LABEL.shared : userName(t.userId),
    Number(t.amount),
    t.memo ?? '',
  ]);
  return toCsv([header, ...rows]);
}

// xlsxは現行Excel家計簿の構成に近い形で、データ種別ごとにシートを分ける
export async function exportHouseholdXlsx(householdId: bigint): Promise<Buffer> {
  const { categories, transactions, incomes, preSavings, weeklyBudgets, categoryName, userName } =
    await loadHouseholdData(householdId);

  const wb = XLSX.utils.book_new();

  const categorySheet = XLSX.utils.aoa_to_sheet([
    ['区分', '費目'],
    ...categories.map((c) => [CATEGORY_TYPE_LABEL[c.type] ?? c.type, `${c.icon ?? ''}${c.name}`]),
  ]);
  XLSX.utils.book_append_sheet(wb, categorySheet, '費目マスタ');

  const transactionSheet = XLSX.utils.aoa_to_sheet([
    ['日付', '費目', '対象者', '金額', 'メモ'],
    ...transactions.map((t) => [
      toDateString(t.transactionDate),
      categoryName(t.categoryId),
      t.splitType === 'shared' ? SPLIT_TYPE_LABEL.shared : userName(t.userId),
      Number(t.amount),
      t.memo ?? '',
    ]),
  ]);
  XLSX.utils.book_append_sheet(wb, transactionSheet, '取引');

  const incomeSheet = XLSX.utils.aoa_to_sheet([
    ['年', '月', '対象者', '費目', '金額'],
    ...incomes.map((i) => [i.year, i.month, userName(i.userId), categoryName(i.categoryId), Number(i.amount)]),
  ]);
  XLSX.utils.book_append_sheet(wb, incomeSheet, '収入');

  const preSavingSheet = XLSX.utils.aoa_to_sheet([
    ['年', '月', '対象者', '費目', '予算額', '実績額'],
    ...preSavings.map((p) => [
      p.year,
      p.month,
      userName(p.userId),
      categoryName(p.categoryId),
      Number(p.budgetAmount),
      Number(p.actualAmount),
    ]),
  ]);
  XLSX.utils.book_append_sheet(wb, preSavingSheet, '先取り貯金');

  const weeklyBudgetSheet = XLSX.utils.aoa_to_sheet([
    ['年', '月', '週', '費目', '予算額'],
    ...weeklyBudgets.map((w) => [w.year, w.month, w.weekNo, categoryName(w.categoryId), Number(w.budgetAmount)]),
  ]);
  XLSX.utils.book_append_sheet(wb, weeklyBudgetSheet, '週次予算');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
