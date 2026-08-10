import ExcelJS from 'exceljs';
import { db } from '@/lib/db';

export async function GET() {
  const [transactions] = await db.query('SELECT * FROM transactions');
  const [categorySummary] = await db.query(`
    SELECT category,
      SUM(CASE WHEN type='income' THEN amount ELSE 0 END) AS income,
      SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expense
    FROM transactions
    GROUP BY category
  `);

  const workbook = new ExcelJS.Workbook();

  // シート1：取引一覧
  const sheet1 = workbook.addWorksheet('Transactions');
  sheet1.columns = [
    { header: '日付', key: 'date' },
    { header: 'タイプ', key: 'type' },
    { header: 'カテゴリ', key: 'category' },
    { header: '金額', key: 'amount' },
    { header: 'メモ', key: 'memo' }
  ];
  transactions.forEach((t: any) => sheet1.addRow(t));

  // シート2：カテゴリ別集計
  const sheet2 = workbook.addWorksheet('Category Summary');
  sheet2.columns = [
    { header: 'カテゴリ', key: 'category' },
    { header: '収入', key: 'income' },
    { header: '支出', key: 'expense' }
  ];
  categorySummary.forEach((c: any) => sheet2.addRow(c));

  // シート3：グラフ用データ
  const sheet3 = workbook.addWorksheet('Chart Data');
  sheet3.addRow(['カテゴリ', '収入', '支出']);
  categorySummary.forEach((c: any) =>
    sheet3.addRow([c.category, c.income, c.expense])
  );

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=kakeibo.xlsx'
    }
  });
}
