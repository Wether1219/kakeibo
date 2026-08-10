'use client';

export default function ExportAndDeleteButton() {
  const handleExport = async () => {
    if (!confirm('エクスポート後、該当データは削除されます。本当に実行しますか？')) return;

    const res = await fetch('/api/export-and-delete');
    if (res.status === 204) {
      alert('エクスポート対象のデータがありません。');
      return;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'unknown' }));
      alert('エクスポートに失敗しました: ' + (err.message || res.statusText));
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    alert('エクスポートと削除が完了しました。');
  };

  return (
    <button type="button" onClick={handleExport} style={{ padding: '8px 16px', cursor: 'pointer' }}>
      CSVエクスポートして削除
    </button>
  );
}
