import { useEffect, useState } from 'react';
import { User, fetchUsers } from '../api/users';
import { AuditLog, fetchAuditLogs } from '../api/auditLogs';
import { downloadExport } from '../api/export';

type SettingsTab = 'members' | 'history' | 'export';

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'members', label: '世帯メンバー' },
  { key: 'history', label: '変更履歴' },
  { key: 'export', label: 'エクスポート' },
];

const TARGET_TABLE_LABELS: Record<string, string> = {
  categories: '費目マスタ',
  transactions: '取引',
  incomes: '収入',
  pre_savings: '先取り貯金',
  weekly_budgets: '週次予算',
  assets: '資産（口座）',
  asset_balances: '資産残高',
};

const ACTION_LABELS: Record<string, string> = {
  create: '追加',
  update: '更新',
  delete: '削除',
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// SC11（設定・履歴画面）：世帯メンバー一覧（読み取りのみ。追加・編集はアカウント発行を伴うため別途対応）、
// 変更履歴（GET /audit-logs）、CSV/Excelエクスポート（GET /export）をタブ切替で表示する。
export function SC11_Settings() {
  const [tab, setTab] = useState<SettingsTab>('members');
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchUsers(), fetchAuditLogs({ limit: 100 })])
      .then(([userList, logList]) => {
        if (cancelled) return;
        setUsers(userList);
        setLogs(logList);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const userMap = new Map(users.map((u) => [u.id, u]));

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setExporting(format);
    setExportError(null);
    try {
      await downloadExport(format);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">設定・履歴</h1>

      <div className="flex gap-2 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-bold border-b-2 -mb-px ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-400">読み込み中...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && tab === 'members' && (
        <div className="rounded border border-gray-200 bg-white divide-y divide-gray-100">
          {users.map((u) => (
            <div key={u.id} className="px-4 py-3 text-sm">
              {u.displayName}
            </div>
          ))}
          <p className="px-4 py-3 text-xs text-gray-400">
            メンバーの追加・編集にはアカウント発行の仕組みが別途必要なため、現時点では一覧表示のみに対応しています。
          </p>
        </div>
      )}

      {!loading && tab === 'history' && (
        <div className="rounded border border-gray-200 bg-white divide-y divide-gray-100">
          {logs.length === 0 && (
            <p className="px-4 py-4 text-sm text-gray-400">変更履歴がありません</p>
          )}
          {logs.map((log) => (
            <details key={log.id} className="px-4 py-2 text-sm">
              <summary className="cursor-pointer select-none flex flex-wrap items-center gap-2">
                <span className="text-gray-400 w-32 shrink-0">{formatDateTime(log.createdAt)}</span>
                <span className="w-12 shrink-0 font-bold">{ACTION_LABELS[log.action] ?? log.action}</span>
                <span className="flex-1 min-w-[6rem]">
                  {TARGET_TABLE_LABELS[log.targetTable] ?? log.targetTable}
                </span>
                <span className="text-gray-500 shrink-0">
                  {userMap.get(log.userId)?.displayName ?? '-'}
                </span>
              </summary>
              <pre className="mt-2 bg-gray-50 rounded p-2 text-xs overflow-x-auto">
                {JSON.stringify(log.diff, null, 2)}
              </pre>
            </details>
          ))}
        </div>
      )}

      {!loading && tab === 'export' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">世帯のデータをファイルとしてダウンロードできます。</p>
          {exportError && <p className="text-sm text-red-600">{exportError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={exporting !== null}
              onClick={() => handleExport('csv')}
              className="bg-blue-600 text-white rounded px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {exporting === 'csv' ? 'ダウンロード中...' : 'CSVダウンロード'}
            </button>
            <button
              type="button"
              disabled={exporting !== null}
              onClick={() => handleExport('xlsx')}
              className="bg-blue-600 text-white rounded px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {exporting === 'xlsx' ? 'ダウンロード中...' : 'Excelダウンロード'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
