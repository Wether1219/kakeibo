import * as XLSX from 'xlsx';
import { prisma } from '../prisma';
import { listMonthSheetNames, readMonthSheetInfo, MonthSheetInfo } from './excelUtil';
import { importCategories } from './importCategories';
import { importIncomes } from './importIncomes';
import { importPreSavings } from './importPreSavings';
import { importTransactions } from './importTransactions';
import { importWeeklyBudgets } from './importWeeklyBudgets';

export interface ImportSummary {
  categories: { createdCount: number; updatedCount: number };
  incomes: { importedCount: number };
  preSavings: { importedCount: number };
  transactions: { importedCount: number };
  weeklyBudgets: { importedCount: number };
}

// docs/03_詳細設計書.md 6章：費目マスタ→incomes→pre_savings→transactions→weekly_budgetsの順で投入する
// （後続テーブルは費目マスタ投入後のcategoryIdに依存するため）。
export async function runImportWorkbook(wb: XLSX.WorkBook, householdId: bigint): Promise<ImportSummary> {
  const monthSheetNames = listMonthSheetNames(wb);
  const monthSheets: MonthSheetInfo[] = monthSheetNames.map((name) =>
    readMonthSheetInfo(wb, name)
  );

  const users = await prisma.user.findMany({ where: { householdId }, orderBy: { id: 'asc' } });
  if (users.length === 0) {
    throw new Error(`household_id=${householdId} にユーザーが存在しません。先にユーザーを登録してください`);
  }
  const userIdByDisplayName = new Map(users.map((u) => [u.displayName, u.id]));
  const defaultCreatedBy = users[0].id;

  const categories = await importCategories(wb, householdId);
  const incomes = await importIncomes(
    wb,
    householdId,
    monthSheets,
    categories.byTypeName,
    userIdByDisplayName
  );
  const preSavings = await importPreSavings(
    wb,
    householdId,
    monthSheets,
    categories.byTypeName,
    userIdByDisplayName
  );
  const transactions = await importTransactions(
    wb,
    householdId,
    monthSheets,
    categories.byRawText,
    userIdByDisplayName,
    defaultCreatedBy
  );
  const weeklyBudgets = await importWeeklyBudgets(wb, householdId, monthSheets, categories.byTypeName);

  return {
    categories: { createdCount: categories.createdCount, updatedCount: categories.updatedCount },
    incomes,
    preSavings,
    transactions,
    weeklyBudgets,
  };
}

// CLI用：ファイルパスから読み込む（npm run migrate:excel）。
export async function runImport(xlsmPath: string, householdId: bigint): Promise<ImportSummary> {
  const wb = XLSX.readFile(xlsmPath, { cellFormula: true, cellDates: true });
  return runImportWorkbook(wb, householdId);
}

// API用：アップロードされたファイルのバッファから読み込む（POST /import/excel）。
export async function runImportBuffer(buffer: Buffer, householdId: bigint): Promise<ImportSummary> {
  const wb = XLSX.read(buffer, { type: 'buffer', cellFormula: true, cellDates: true });
  return runImportWorkbook(wb, householdId);
}

if (require.main === module) {
  const [, , xlsmPath, householdIdArg] = process.argv;
  if (!xlsmPath || !householdIdArg) {
    console.error('使い方: npm run migrate:excel -- <xlsmファイルパス> <household_id>');
    process.exit(1);
  }
  runImport(xlsmPath, BigInt(householdIdArg))
    .then((summary) => {
      console.log('移行完了:', JSON.stringify(summary, null, 2));
      return prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error('移行失敗:', e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
