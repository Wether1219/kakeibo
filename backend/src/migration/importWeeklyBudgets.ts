import * as XLSX from 'xlsx';
import { bulkUpsertWeeklyBudgets, WeeklyBudgetInput } from '../services/weeklyBudgetService';
import { splitIconName, readCellString, readCellAmount, MonthSheetInfo } from './excelUtil';

const NAME_COL = 'L';
// 週1・2週目/3・4週目/5週目・ALLの3ブロックが12行間隔で繰り返される（各ブロック: ヘッダ行+費目8行）。
// 5週目ブロックの右列（P）はALL(月合計)であり実週ではないため対象外。
const BLOCKS: { headerRow: number; weekNos: [number, number | null] }[] = [
  { headerRow: 16, weekNos: [1, 2] },
  { headerRow: 28, weekNos: [3, 4] },
  { headerRow: 40, weekNos: [5, null] },
];
const CATEGORY_ROW_COUNT = 8;
const LEFT_BUDGET_COL = 'M';
const RIGHT_BUDGET_COL = 'P';

export async function importWeeklyBudgets(
  wb: XLSX.WorkBook,
  householdId: bigint,
  monthSheets: MonthSheetInfo[],
  categoryByTypeName: Map<string, bigint>
): Promise<{ importedCount: number }> {
  const items: WeeklyBudgetInput[] = [];

  for (const { sheetName, year, month } of monthSheets) {
    const ws = wb.Sheets[sheetName];
    for (const { headerRow, weekNos } of BLOCKS) {
      for (let i = 0; i < CATEGORY_ROW_COUNT; i++) {
        const row = headerRow + 1 + i;
        const rawName = readCellString(ws, `${NAME_COL}${row}`);
        if (!rawName) continue;
        const { name } = splitIconName(rawName);
        const categoryId = categoryByTypeName.get(`variable_expense:${name}`);
        if (categoryId === undefined) {
          throw new Error(`${sheetName}!${NAME_COL}${row}: 費目「${name}」がマッピングできません`);
        }

        const [leftWeek, rightWeek] = weekNos;
        items.push({
          year,
          month,
          weekNo: leftWeek,
          categoryId,
          budgetAmount: readCellAmount(ws, `${LEFT_BUDGET_COL}${row}`),
        });
        if (rightWeek !== null) {
          items.push({
            year,
            month,
            weekNo: rightWeek,
            categoryId,
            budgetAmount: readCellAmount(ws, `${RIGHT_BUDGET_COL}${row}`),
          });
        }
      }
    }
  }

  await bulkUpsertWeeklyBudgets(householdId, items);
  return { importedCount: items.length };
}
