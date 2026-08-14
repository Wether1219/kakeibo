import { apiFetch } from './client';

export type ExportFormat = 'csv' | 'xlsx';

// GET /exportはファイルレスポンスでAuthorizationヘッダーが必要なため、
// 単純な<a href>ではなくapiFetchで取得したBlobを一時リンク経由でダウンロードさせる。
export async function downloadExport(format: ExportFormat): Promise<void> {
  const res = await apiFetch(`/export?format=${format}`);
  if (!res.ok) throw new Error('エクスポートに失敗しました');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = format === 'csv' ? 'kakeibo_export.csv' : 'kakeibo_export.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
