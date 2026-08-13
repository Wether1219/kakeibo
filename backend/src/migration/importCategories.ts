import * as XLSX from 'xlsx';
import { CategoryType } from '@prisma/client';
import { prisma } from '../prisma';
import { splitIconName, readCellString } from './excelUtil';

export interface CategoryImportResult {
  createdCount: number;
  updatedCount: number;
  // 費目マスタのセル文字列（アイコン+名前, 例:「🔥💡光熱費」）→ カテゴリ情報。取引（transactions）の費目マッピングに使う。
  byRawText: Map<string, { id: bigint; type: CategoryType }>;
  // type別の名前→id。key: `${type}:${name}`
  byTypeName: Map<string, bigint>;
}

interface ColumnSpec {
  column: string;
  type: CategoryType;
}

interface ParsedEntry {
  raw: string;
  type: CategoryType;
  name: string;
  icon: string | null;
  sortOrder: number;
}

// 費目マスタシートの列レイアウト（docs/03_詳細設計書.md 6章）。データは3行目から下方向に空欄まで続く。
const COLUMNS: ColumnSpec[] = [
  { column: 'B', type: 'income' },
  { column: 'G', type: 'pre_saving' },
  { column: 'L', type: 'fixed_expense' },
  { column: 'Q', type: 'variable_expense' },
];
const START_ROW = 3;

export async function importCategories(
  wb: XLSX.WorkBook,
  householdId: bigint
): Promise<CategoryImportResult> {
  const ws = wb.Sheets['費目マスタ'];
  if (!ws) throw new Error('費目マスタシートが見つかりません');

  // 固定費(L列)を先に処理する。このテンプレートでは固定費・変動費の費目名が重複することはないが、
  // 将来的に同名の費目がどちらの列にも登録された場合、取引の費目マッピング（byRawText）は
  // 常に固定費側を優先する（月次シートの集計 支出ブロックが固定費側のみをSUMIFSで集計する挙動に合わせるため）。
  const orderedColumns = [...COLUMNS].sort((a) => (a.type === 'fixed_expense' ? -1 : 0));

  const entries: ParsedEntry[] = [];
  for (const { column, type } of orderedColumns) {
    let row = START_ROW;
    let sortOrder = 0;
    for (;;) {
      const raw = readCellString(ws, `${column}${row}`);
      if (!raw) break;
      const { icon, name } = splitIconName(raw);
      entries.push({ raw, type, name, icon, sortOrder });
      row++;
      sortOrder++;
    }
  }

  // 既存カテゴリを一度だけ取得し、行ごとのfindUnique往復を避ける（DB往復が多いと移行対象の月数が多い場合に遅くなるため）。
  const existing = await prisma.category.findMany({ where: { householdId } });
  const existingKeys = new Set(existing.map((c) => `${c.type}:${c.name}`));

  const upserted = await prisma.$transaction(
    entries.map(({ type, name, icon, sortOrder }) =>
      prisma.category.upsert({
        where: { householdId_type_name: { householdId, type, name } },
        update: { icon, sortOrder },
        create: { householdId, type, name, icon, sortOrder },
      })
    )
  );

  const byRawText = new Map<string, { id: bigint; type: CategoryType }>();
  const byTypeName = new Map<string, bigint>();
  let createdCount = 0;
  let updatedCount = 0;

  entries.forEach((entry, i) => {
    const category = upserted[i];
    if (existingKeys.has(`${entry.type}:${entry.name}`)) {
      updatedCount++;
    } else {
      createdCount++;
    }
    if (!byRawText.has(entry.raw)) {
      byRawText.set(entry.raw, { id: category.id, type: entry.type });
    }
    byTypeName.set(`${entry.type}:${entry.name}`, category.id);
  });

  return { createdCount, updatedCount, byRawText, byTypeName };
}
