import * as XLSX from 'xlsx';

export const FIXED_SHEET_NAMES = new Set([
  '変更履歴',
  '費目マスタ',
  '資産管理シート',
  '収支可視化シート',
  '年間推移',
]);

// 月次シートは「27年1月」のような名前だが、実際の年・月はシート名ではなくB1(月)・B3(年)セルの値を使う
// （設計書コメント通り「年・月を変更するとカレンダーが自動更新される」ため、シート名は表示ラベルに過ぎない）。
export function listMonthSheetNames(wb: XLSX.WorkBook): string[] {
  return wb.SheetNames.filter((name) => !FIXED_SHEET_NAMES.has(name));
}

export interface MonthSheetInfo {
  sheetName: string;
  year: number;
  month: number;
}

export function readMonthSheetInfo(wb: XLSX.WorkBook, sheetName: string): MonthSheetInfo {
  const ws = wb.Sheets[sheetName];
  const month = ws['B1']?.v;
  const year = ws['B3']?.v;
  if (typeof month !== 'number' || typeof year !== 'number') {
    throw new Error(`${sheetName}: B1(月)・B3(年)セルが数値ではありません`);
  }
  return { sheetName, year, month };
}

// 費目名セルは「絵文字アイコン+費目名」の形式（例:「🔥💡光熱費」）。
// アイコンは常に非文字（絵文字・記号）、費目名は常に日本語（Unicode Letter）で始まるため、
// 先頭の非Letter連続部分をアイコン、以降を費目名として分離する。
export function splitIconName(raw: string): { icon: string | null; name: string } {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\P{L}+)?(\p{L}.*)$/u);
  if (!match) {
    return { icon: null, name: trimmed };
  }
  const icon = match[1] ?? '';
  return { icon: icon.length > 0 ? icon : null, name: match[2] };
}

export function readCellString(ws: XLSX.WorkSheet, addr: string): string | null {
  const v = ws[addr]?.v;
  if (v === undefined || v === null || v === '') return null;
  return String(v).trim();
}

export function readCellAmount(ws: XLSX.WorkSheet, addr: string): number {
  const v = ws[addr]?.v;
  if (typeof v === 'number') return v;
  return 0;
}

// 日付セルは「日付形式で入力された値」を想定するが、
// カスタム書式（例:「d"日"」）等でSheetJSがDate変換しない場合に備え、
// 数値のみの場合はシートのB1(月)・B3(年)と組み合わせて日付を復元する。
export function readTransactionDate(
  ws: XLSX.WorkSheet,
  addr: string,
  year: number,
  month: number
): Date | null {
  const v = ws[addr]?.v;
  if (v === undefined || v === null || v === '') return null;
  if (v instanceof Date) {
    return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  }
  if (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 31) {
    return new Date(Date.UTC(year, month - 1, v));
  }
  return null;
}
