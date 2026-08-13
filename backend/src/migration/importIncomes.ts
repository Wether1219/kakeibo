import * as XLSX from 'xlsx';
import { bulkUpsertIncomes, IncomeInput } from '../services/incomeService';
import { splitIconName, readCellString, readCellAmount, MonthSheetInfo } from './excelUtil';

const START_ROW = 7;
const END_ROW = 16;
const NAME_COL = 'B';
const PERSON_COL = 'D';
const AMOUNT_COL = 'E';

export async function importIncomes(
  wb: XLSX.WorkBook,
  householdId: bigint,
  monthSheets: MonthSheetInfo[],
  categoryByTypeName: Map<string, bigint>,
  userIdByDisplayName: Map<string, bigint>
): Promise<{ importedCount: number }> {
  const items: IncomeInput[] = [];

  for (const { sheetName, year, month } of monthSheets) {
    const ws = wb.Sheets[sheetName];
    for (let row = START_ROW; row <= END_ROW; row++) {
      const rawName = readCellString(ws, `${NAME_COL}${row}`);
      const personName = readCellString(ws, `${PERSON_COL}${row}`);
      if (!rawName || !personName) continue;
      const { name } = splitIconName(rawName);
      const categoryId = categoryByTypeName.get(`income:${name}`);
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
        amount: readCellAmount(ws, `${AMOUNT_COL}${row}`),
      });
    }
  }

  await bulkUpsertIncomes(householdId, items);
  return { importedCount: items.length };
}
