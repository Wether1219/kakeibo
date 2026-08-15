import path from 'path';
import * as XLSX from 'xlsx';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/prisma';
import { runImport } from '../src/migration/runImport';
import { importCategories } from '../src/migration/importCategories';
import { importIncomes } from '../src/migration/importIncomes';
import { importTransactions } from '../src/migration/importTransactions';
import { importWeeklyBudgets } from '../src/migration/importWeeklyBudgets';
import { listMonthSheetNames, readCellAmount, readMonthSheetInfo } from '../src/migration/excelUtil';
import { calculateSettlement } from '../src/services/settlementService';

const FIXTURE_PATH = path.join(__dirname, 'fixtures', '雛形_家計簿_第1_4版.xlsm');

const TEST_HOUSEHOLD_ID = 999919n;
const USER_TAIYO = 999918n;
const USER_MIRANO = 999917n;

const SYNTHETIC_HOUSEHOLD_ID = 999916n;
const SYN_USER_TAIYO = 999915n;
const SYN_USER_MIRANO = 999914n;

// 年間推移シートの行レイアウト（費目マスタの並び順と一致。docs/03_詳細設計書.md 6章の実データ調査により判明）。
// 収入: rows3-12（たいよう5費目→rows3-7, みらの5費目→rows8-12）
// 固定費: rows15-28（たいよう7費目→rows15-21, みらの7費目→rows22-28）
// 変動費: rows31-46（たいよう8費目→rows31-38, みらの8費目→rows39-46）※純粋変動費8費目のみ対象
const INCOME_NAMES = ['給与', '賞与', '配当金', '臨時収入', 'その他'];
const FIXED_NAMES = ['光熱費', '水道代', '通信費', 'サブスク', '奨学金', '保険', '住宅'];
const VARIABLE_NAMES = ['食費', '日用品', '雑費', '趣味・娯楽', '交際費', '衣服・美容', '健康・医療', '交通費'];
const MONTH_COLUMNS = ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P']; // 1月〜12月

async function resetHousehold(id: bigint) {
  await prisma.weeklyBudget.deleteMany({ where: { householdId: id } });
  await prisma.transaction.deleteMany({ where: { householdId: id } });
  await prisma.preSaving.deleteMany({ where: { householdId: id } });
  await prisma.income.deleteMany({ where: { householdId: id } });
  await prisma.category.deleteMany({ where: { householdId: id } });
  await prisma.user.deleteMany({ where: { householdId: id } });
  await prisma.household.deleteMany({ where: { id } });
  await prisma.household.create({ data: { id } });
}

function monthRange(year: number, month: number) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

describe('Excelデータ移行（docs/03_詳細設計書.md 6章）', () => {
  beforeAll(async () => {
    await resetHousehold(TEST_HOUSEHOLD_ID);
    await prisma.user.createMany({
      data: [
        { id: USER_TAIYO, householdId: TEST_HOUSEHOLD_ID, displayName: 'たいよう', email: `user${USER_TAIYO}@test.local`, passwordHash: 'test-hash' },
        { id: USER_MIRANO, householdId: TEST_HOUSEHOLD_ID, displayName: 'みらの', email: `user${USER_MIRANO}@test.local`, passwordHash: 'test-hash' },
      ],
    });

    await resetHousehold(SYNTHETIC_HOUSEHOLD_ID);
    await prisma.user.createMany({
      data: [
        { id: SYN_USER_TAIYO, householdId: SYNTHETIC_HOUSEHOLD_ID, displayName: 'たいよう', email: `user${SYN_USER_TAIYO}@test.local`, passwordHash: 'test-hash' },
        { id: SYN_USER_MIRANO, householdId: SYNTHETIC_HOUSEHOLD_ID, displayName: 'みらの', email: `user${SYN_USER_MIRANO}@test.local`, passwordHash: 'test-hash' },
      ],
    });
  });

  afterAll(async () => {
    await resetHousehold(TEST_HOUSEHOLD_ID);
    await prisma.household.deleteMany({ where: { id: TEST_HOUSEHOLD_ID } });
    await resetHousehold(SYNTHETIC_HOUSEHOLD_ID);
    await prisma.household.deleteMany({ where: { id: SYNTHETIC_HOUSEHOLD_ID } });
    await prisma.$disconnect();
  });

  describe('雛形ファイルそのままの移行と年間推移シートとの突合', () => {
    // 12ヶ月分の全シート走査＋費目マスタのupsertを含むため既定の5秒タイムアウトでは不足する。
    it('全テーブルが投入され、件数が費目マスタ・シート構造から期待される数と一致する', async () => {
      const summary = await runImport(FIXTURE_PATH, TEST_HOUSEHOLD_ID);

      // 費目マスタ: 収入5 + 先取り貯金4 + 固定費7 + 変動費8 = 24
      expect(summary.categories.createdCount).toBe(24);
      expect(summary.categories.updatedCount).toBe(0);
      // incomes: 12ヶ月 × (5費目×2人) = 120
      expect(summary.incomes.importedCount).toBe(120);
      // pre_savings: 12ヶ月 × (4費目×2人) = 96
      expect(summary.preSavings.importedCount).toBe(96);
      // weekly_budgets: 12ヶ月 × 8費目 × 5週 = 480
      expect(summary.weeklyBudgets.importedCount).toBe(480);
      // このテンプレートは日付未入力（実取引なし）のため取引は0件
      expect(summary.transactions.importedCount).toBe(0);
    }, 30000);

    // 前のテストで投入されたTEST_HOUSEHOLD_IDのデータを突合する（同一describe内で順次実行される前提）。
    it('年間推移シートの収入・固定費・変動費の値と、移行後DBの集計値が全月・全費目で一致する（テンプレートは全て¥0）', async () => {
      const wb = XLSX.readFile(FIXTURE_PATH, { cellFormula: true, cellDates: true });
      const trendSheet = wb.Sheets['年間推移'];
      const users = [
        { name: 'たいよう', id: USER_TAIYO },
        { name: 'みらの', id: USER_MIRANO },
      ];

      // N+1を避けるため、費目・収入・取引を一度だけ取得しメモリ上で突合する。
      const categories = await prisma.category.findMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
      const categoryIdByTypeName = new Map(
        categories.map((c) => [`${c.type}:${c.name}`, c.id.toString()])
      );
      const incomes = await prisma.income.findMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
      const incomeAmount = new Map(
        incomes.map((i) => [`${i.year}:${i.month}:${i.userId}:${i.categoryId}`, Number(i.amount)])
      );
      const transactions = await prisma.transaction.findMany({ where: { householdId: TEST_HOUSEHOLD_ID } });

      const expenseAgg = new Map<string, { self: Map<string, number>; sharedTotal: number }>();
      for (const tx of transactions) {
        const y = tx.transactionDate.getUTCFullYear();
        const m = tx.transactionDate.getUTCMonth() + 1;
        const key = `${y}:${m}:${tx.categoryId}`;
        if (!expenseAgg.has(key)) {
          expenseAgg.set(key, { self: new Map(), sharedTotal: 0 });
        }
        const entry = expenseAgg.get(key)!;
        if (tx.splitType === 'self' && tx.userId !== null) {
          const uk = tx.userId.toString();
          entry.self.set(uk, (entry.self.get(uk) ?? 0) + Number(tx.amount));
        } else if (tx.splitType === 'shared') {
          entry.sharedTotal += Number(tx.amount);
        }
      }

      for (let month = 1; month <= 12; month++) {
        const col = MONTH_COLUMNS[month - 1];

        // 収入: DBのIncome.amountをそのまま突合（年間推移の収入セルは月次シートの当該セルを直接参照しているため）
        for (const [personIdx, user] of users.entries()) {
          for (const [nameIdx, name] of INCOME_NAMES.entries()) {
            const row = 3 + personIdx * INCOME_NAMES.length + nameIdx;
            const expected = readCellAmount(trendSheet, `${col}${row}`);
            const categoryId = categoryIdByTypeName.get(`income:${name}`);
            const actual = incomeAmount.get(`2027:${month}:${user.id}:${categoryId}`) ?? 0;
            expect(actual).toBe(expected);
          }
        }

        // 固定費: 年間推移のSUMIFS（人の完全一致のみ、「両方」は含まない）と同じ条件でDBを集計
        for (const [personIdx, user] of users.entries()) {
          for (const [nameIdx, name] of FIXED_NAMES.entries()) {
            const row = 15 + personIdx * FIXED_NAMES.length + nameIdx;
            const expected = readCellAmount(trendSheet, `${col}${row}`);
            const categoryId = categoryIdByTypeName.get(`fixed_expense:${name}`);
            const actual = expenseAgg.get(`2027:${month}:${categoryId}`)?.self.get(user.id.toString()) ?? 0;
            expect(actual).toBe(expected);
          }
        }

        // 変動費: 年間推移の計算式（本人分 + 「両方」分/2）と同じ条件でDBを集計
        for (const [personIdx, user] of users.entries()) {
          for (const [nameIdx, name] of VARIABLE_NAMES.entries()) {
            const row = 31 + personIdx * VARIABLE_NAMES.length + nameIdx;
            const expected = readCellAmount(trendSheet, `${col}${row}`);
            const categoryId = categoryIdByTypeName.get(`variable_expense:${name}`);
            const entry = expenseAgg.get(`2027:${month}:${categoryId}`);
            const actual = (entry?.self.get(user.id.toString()) ?? 0) + (entry?.sharedTotal ?? 0) / 2;
            expect(actual).toBe(expected);
          }
        }
      }
    }, 30000);

    // docs/08_割り勘計算 仕様書.md 6章：各月のO52セル（=B87、精算金額。符号は「たいよう→みらの」が正）と
    // 移行後DBの取引をcalculateSettlement()に渡した結果が一致することを確認する。
    it('各月のO52セルの値（符号込み）と、移行後DBの取引によるcalculateSettlement()の結果が一致する（テンプレートは精算マーカー未設定のため¥0）', async () => {
      const wb = XLSX.readFile(FIXTURE_PATH, { cellFormula: true, cellDates: true });
      const monthSheets = listMonthSheetNames(wb).map((name) => readMonthSheetInfo(wb, name));

      for (const { sheetName, year, month } of monthSheets) {
        const ws = wb.Sheets[sheetName];
        const expectedO52 = readCellAmount(ws, 'O52');

        const { start, end } = monthRange(year, month);
        const transactions = await prisma.transaction.findMany({
          where: {
            householdId: TEST_HOUSEHOLD_ID,
            transactionDate: { gte: start, lt: end },
            settlementPayerUserId: { not: null },
          },
          select: {
            settlementPayerUserId: true,
            settlementBurden: true,
            settlementPartialAmount: true,
            amount: true,
          },
        });

        const result = calculateSettlement(
          transactions.map((t) => ({
            settlementPayerUserId: t.settlementPayerUserId,
            settlementBurden: t.settlementBurden,
            settlementPartialAmount:
              t.settlementPartialAmount === null ? null : Number(t.settlementPartialAmount),
            amount: Number(t.amount),
          })),
          // O52の符号は「たいよう→みらの」が正なので、user_id昇順ではなくたいようをA固定で渡す。
          [USER_TAIYO, USER_MIRANO]
        );
        const signedAmount =
          result.direction === 'NONE' ? 0 : result.direction === 'A_TO_B' ? result.amount : -result.amount;

        expect(signedAmount).toBe(expectedO52);
      }
    }, 30000);
  });

  // 雛形ファイルは費目名以外ほぼ空欄のテンプレートのため、上記の突合テストは実質「0円同士の一致」の検証に留まる。
  // 移行ロジック・集計ロジックが実データでも正しく機能することを確認するため、
  // 27年1月シートの一部セルにのみ実データを模したセルをメモリ上で書き込み、
  // 元Excelの計算式（月次シートのE22:E35＝固定費SUMIFS、J22:J37＝変動費SUMIFS+シェア/2）が導く期待値と
  // 移行後DBの集計値が一致することを検証する。
  describe('実データを模した値での移行・集計ロジックの検証', () => {
    it('収入・固定費（本人のみ集計）・変動費（本人+シェア分/2）・週次予算が正しく移行・集計される', async () => {
      const wb = XLSX.readFile(FIXTURE_PATH, { cellFormula: true, cellDates: true });
      const ws = wb.Sheets['27年1月'];

      // 収入: たいよう給与
      ws['E7'] = { t: 'n', v: 300000 };
      // 固定費取引: たいよう 光熱費 8000円（自分のみ）。割り勘マーカー☀（たいよう立替・折半）、半端額1000円。
      ws['T6'] = { t: 'n', v: 1 };
      ws['V6'] = { t: 's', v: 'たいよう' };
      ws['W6'] = { t: 's', v: '🔥💡光熱費' };
      ws['X6'] = { t: 'n', v: 8000 };
      ws['Z6'] = { t: 's', v: '☀' };
      ws['AA6'] = { t: 'n', v: 1000 };
      // 変動費取引: みらの 食費 1500円（自分のみ）。割り勘マーカーなし＝精算対象外。
      ws['T8'] = { t: 'n', v: 3 };
      ws['V8'] = { t: 's', v: 'みらの' };
      ws['W8'] = { t: 's', v: '🍙食費' };
      ws['X8'] = { t: 'n', v: 1500 };
      // 変動費取引: 両方（折半）食費 3000円。割り勘マーカー♠（みらの立替・全額たいよう負担）、半端額500円。
      ws['T10'] = { t: 'n', v: 5 };
      ws['V10'] = { t: 's', v: '両方' };
      ws['W10'] = { t: 's', v: '🍙食費' };
      ws['X10'] = { t: 'n', v: 3000 };
      ws['Z10'] = { t: 's', v: '♠' };
      ws['AA10'] = { t: 'n', v: 500 };
      // 週次予算: 食費 1week 予算5000円
      ws['M17'] = { t: 'n', v: 5000 };

      const monthSheets = [{ sheetName: '27年1月', year: 2027, month: 1 }];
      const categories = await importCategories(wb, SYNTHETIC_HOUSEHOLD_ID);
      const userIdByDisplayName = new Map<string, bigint>([
        ['たいよう', SYN_USER_TAIYO],
        ['みらの', SYN_USER_MIRANO],
      ]);

      await importIncomes(wb, SYNTHETIC_HOUSEHOLD_ID, monthSheets, categories.byTypeName, userIdByDisplayName);
      await importTransactions(
        wb,
        SYNTHETIC_HOUSEHOLD_ID,
        monthSheets,
        categories.byRawText,
        userIdByDisplayName,
        SYN_USER_TAIYO
      );
      await importWeeklyBudgets(wb, SYNTHETIC_HOUSEHOLD_ID, monthSheets, categories.byTypeName);

      const incomeCategory = await prisma.category.findUniqueOrThrow({
        where: {
          householdId_type_name: { householdId: SYNTHETIC_HOUSEHOLD_ID, type: 'income', name: '給与' },
        },
      });
      const income = await prisma.income.findUniqueOrThrow({
        where: {
          householdId_year_month_userId_categoryId: {
            householdId: SYNTHETIC_HOUSEHOLD_ID,
            year: 2027,
            month: 1,
            userId: SYN_USER_TAIYO,
            categoryId: incomeCategory.id,
          },
        },
      });
      expect(Number(income.amount)).toBe(300000);

      const fixedCategory = await prisma.category.findUniqueOrThrow({
        where: {
          householdId_type_name: {
            householdId: SYNTHETIC_HOUSEHOLD_ID,
            type: 'fixed_expense',
            name: '光熱費',
          },
        },
      });
      const { start, end } = monthRange(2027, 1);
      const taiyoFixed = await prisma.transaction.aggregate({
        where: {
          householdId: SYNTHETIC_HOUSEHOLD_ID,
          categoryId: fixedCategory.id,
          splitType: 'self',
          userId: SYN_USER_TAIYO,
          transactionDate: { gte: start, lt: end },
        },
        _sum: { amount: true },
      });
      expect(Number(taiyoFixed._sum.amount ?? 0)).toBe(8000);
      // みらの分の集計には計上されない（元Excelの固定費SUMIFSはV列の完全一致のみ集計するため）
      const miranoFixed = await prisma.transaction.aggregate({
        where: {
          householdId: SYNTHETIC_HOUSEHOLD_ID,
          categoryId: fixedCategory.id,
          splitType: 'self',
          userId: SYN_USER_MIRANO,
          transactionDate: { gte: start, lt: end },
        },
        _sum: { amount: true },
      });
      expect(Number(miranoFixed._sum.amount ?? 0)).toBe(0);

      const variableCategory = await prisma.category.findUniqueOrThrow({
        where: {
          householdId_type_name: {
            householdId: SYNTHETIC_HOUSEHOLD_ID,
            type: 'variable_expense',
            name: '食費',
          },
        },
      });
      const sharedAgg = await prisma.transaction.aggregate({
        where: {
          householdId: SYNTHETIC_HOUSEHOLD_ID,
          categoryId: variableCategory.id,
          splitType: 'shared',
          transactionDate: { gte: start, lt: end },
        },
        _sum: { amount: true },
      });
      // 元Excelの変動費集計式（本人分+「両方」分/2）に倣い、両方3000円は1人あたり1500円として計上される
      expect(Number(sharedAgg._sum.amount ?? 0) / 2).toBe(1500);

      const weeklyBudget = await prisma.weeklyBudget.findUniqueOrThrow({
        where: {
          householdId_year_month_weekNo_categoryId: {
            householdId: SYNTHETIC_HOUSEHOLD_ID,
            year: 2027,
            month: 1,
            weekNo: 1,
            categoryId: variableCategory.id,
          },
        },
      });
      expect(Number(weeklyBudget.budgetAmount)).toBe(5000);

      // 割り勘マーカー（Z列・AA列）が1.2節のマッピング通りにsettlement_*カラムへ変換されていることを検証する。
      const taiyoFixedTx = await prisma.transaction.findFirstOrThrow({
        where: {
          householdId: SYNTHETIC_HOUSEHOLD_ID,
          categoryId: fixedCategory.id,
          splitType: 'self',
          userId: SYN_USER_TAIYO,
          transactionDate: { gte: start, lt: end },
        },
      });
      expect(taiyoFixedTx.settlementPayerUserId).toBe(SYN_USER_TAIYO);
      expect(taiyoFixedTx.settlementBurden).toBe('half');
      expect(Number(taiyoFixedTx.settlementPartialAmount)).toBe(1000);

      const sharedVariableTx = await prisma.transaction.findFirstOrThrow({
        where: {
          householdId: SYNTHETIC_HOUSEHOLD_ID,
          categoryId: variableCategory.id,
          splitType: 'shared',
          transactionDate: { gte: start, lt: end },
        },
      });
      expect(sharedVariableTx.settlementPayerUserId).toBe(SYN_USER_MIRANO);
      expect(sharedVariableTx.settlementBurden).toBe('other_full');
      expect(Number(sharedVariableTx.settlementPartialAmount)).toBe(500);

      const miranoVariableTx = await prisma.transaction.findFirstOrThrow({
        where: {
          householdId: SYNTHETIC_HOUSEHOLD_ID,
          categoryId: variableCategory.id,
          splitType: 'self',
          userId: SYN_USER_MIRANO,
          transactionDate: { gte: start, lt: end },
        },
      });
      expect(miranoVariableTx.settlementPayerUserId).toBeNull();
      expect(miranoVariableTx.settlementBurden).toBeNull();
      expect(miranoVariableTx.settlementPartialAmount).toBeNull();
    });
  });
});
