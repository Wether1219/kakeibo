import * as XLSX from 'xlsx';
import { CategoryType, SplitType } from '@prisma/client';
import { prisma } from '../prisma';
import { readCellString, readCellAmount, readTransactionDate, MonthSheetInfo } from './excelUtil';

const START_ROW = 6;
const END_ROW = 159;
const DATE_COL = 'T';
const PERSON_COL = 'V';
const CATEGORY_COL = 'W';
const AMOUNT_COL = 'X';
const MEMO_COL = 'Y';

export async function importTransactions(
  wb: XLSX.WorkBook,
  householdId: bigint,
  monthSheets: MonthSheetInfo[],
  categoryByRawText: Map<string, { id: bigint; type: CategoryType }>,
  userIdByDisplayName: Map<string, bigint>,
  // 「両方（折半）」取引のcreated_byは元Excelに記録がないため、世帯内の代表ユーザー（id最小）を採用する。
  defaultCreatedBy: bigint
): Promise<{ importedCount: number }> {
  let importedCount = 0;

  for (const { sheetName, year, month } of monthSheets) {
    const ws = wb.Sheets[sheetName];
    for (let row = START_ROW; row <= END_ROW; row++) {
      const date = readTransactionDate(ws, `${DATE_COL}${row}`, year, month);
      // 日付未入力の行はテンプレートの空行（実取引ではない）のためスキップする。
      if (!date) continue;

      const personName = readCellString(ws, `${PERSON_COL}${row}`);
      const rawCategory = readCellString(ws, `${CATEGORY_COL}${row}`);
      const amount = readCellAmount(ws, `${AMOUNT_COL}${row}`);
      const memo = readCellString(ws, `${MEMO_COL}${row}`);
      if (!personName || !rawCategory || amount <= 0) continue;

      const category = categoryByRawText.get(rawCategory);
      if (!category) {
        throw new Error(`${sheetName}!${CATEGORY_COL}${row}: 費目「${rawCategory}」がマッピングできません`);
      }

      let splitType: SplitType;
      let userId: bigint | null;
      let createdBy: bigint;
      if (personName === '両方') {
        splitType = 'shared';
        userId = null;
        createdBy = defaultCreatedBy;
      } else {
        const uid = userIdByDisplayName.get(personName);
        if (uid === undefined) {
          throw new Error(`${sheetName}!${PERSON_COL}${row}: 人「${personName}」がマッピングできません`);
        }
        splitType = 'self';
        userId = uid;
        createdBy = uid;
      }

      // transactionService.createTransactionは「当年内の日付のみ」というAPI向けバリデーションを持ち、
      // 過去データの移行とは相容れないため、ここではprismaを直接呼び出す。
      await prisma.transaction.create({
        data: {
          householdId,
          transactionDate: date,
          categoryId: category.id,
          splitType,
          userId,
          amount,
          memo,
          createdBy,
        },
      });
      importedCount++;
    }
  }

  return { importedCount };
}
