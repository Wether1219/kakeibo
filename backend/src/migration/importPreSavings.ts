import * as XLSX from 'xlsx';
import { bulkUpsertPreSavings, PreSavingInput } from '../services/preSavingService';
import { splitIconName, readCellString, readCellAmount, MonthSheetInfo } from './excelUtil';

const START_ROW = 7;
const END_ROW = 14;
const NAME_COL = 'G';
const PERSON_COL = 'I';
const AMOUNT_COL = 'J';

// docs/03_詳細設計書.md 6章：pre_savingsはbudget_amountを空欄扱い（0固定）とし、actual_amountのみExcelから投入する
// （現行Excelには先取り貯金の予算枠という概念が存在しないため）。
export async function importPreSavings(
  wb: XLSX.WorkBook,
  householdId: bigint,
  monthSheets: MonthSheetInfo[],
  categoryByTypeName: Map<string, bigint>,
  userIdByDisplayName: Map<string, bigint>
): Promise<{ importedCount: number }> {
  const items: PreSavingInput[] = [];

  for (const { sheetName, year, month } of monthSheets) {
    const ws = wb.Sheets[sheetName];
    for (let row = START_ROW; row <= END_ROW; row++) {
      const rawName = readCellString(ws, `${NAME_COL}${row}`);
      const personName = readCellString(ws, `${PERSON_COL}${row}`);
      if (!rawName || !personName) continue;
      const { name } = splitIconName(rawName);
      const categoryId = categoryByTypeName.get(`pre_saving:${name}`);
      const userId = userIdByDisplayName.get(personName);
      if (categoryId === undefined || userId === undefined) {
        throw new Error(
          `${sheetName}!${NAME_COL}${row}: 費目「${name}」または人「${personName}」がマッピングできません`
        );
      }
      items.push({
        year,
        month,
        userId,
        categoryId,
        budgetAmount: 0,
        actualAmount: readCellAmount(ws, `${AMOUNT_COL}${row}`),
      });
    }
  }

  await bulkUpsertPreSavings(householdId, items);
  return { importedCount: items.length };
}
