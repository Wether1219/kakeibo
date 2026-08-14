import { useState } from 'react';
import { AssetBalanceRow, OwnerSubtotalRow } from '../api/assetBalances';

interface Props {
  rows: AssetBalanceRow[];
  ownerSubtotals: OwnerSubtotalRow[];
  total: number[];
  onCellChange: (assetId: string, month: number, value: number) => void;
  isSaving: (assetId: string, month: number) => boolean;
  onDelete: (assetId: string, assetName: string) => void;
}

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

export function AssetBalanceTable({
  rows,
  ownerSubtotals,
  total,
  onCellChange,
  isSaving,
  onDelete,
}: Props) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState('');

  const ownerName = (ownerUserId: string) =>
    ownerSubtotals.find((o) => o.ownerUserId === ownerUserId)?.displayName ?? '';

  const startEdit = (assetId: string, month: number, current: number) => {
    setEditingKey(`${assetId}:${month}`);
    setDraftValue(current === 0 ? '' : String(current));
  };

  const commitEdit = (assetId: string, month: number) => {
    const value = draftValue.trim() === '' ? 0 : Number(draftValue);
    if (Number.isFinite(value)) {
      onCellChange(assetId, month, Math.round(value));
    }
    setEditingKey(null);
  };

  return (
    <div className="overflow-x-auto border border-gray-200 rounded">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="sticky left-0 bg-gray-50 z-10 px-3 py-2 text-left font-medium text-gray-500 border-b border-gray-200 whitespace-nowrap">
              名称
            </th>
            {MONTH_LABELS.map((label) => (
              <th
                key={label}
                className="px-3 py-2 text-right font-medium text-gray-500 border-b border-gray-200 whitespace-nowrap"
              >
                {label}
              </th>
            ))}
            <th className="px-2 py-2 border-b border-gray-200" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.assetId} className="border-b border-gray-100">
              <td className="sticky left-0 bg-white z-10 px-3 py-2 whitespace-nowrap">
                {row.assetName}
                {ownerName(row.ownerUserId) && (
                  <span className="text-gray-400">（{ownerName(row.ownerUserId)}）</span>
                )}
              </td>
              {row.months.map((amount, idx) => {
                const month = idx + 1;
                const key = `${row.assetId}:${month}`;
                const saving = isSaving(row.assetId, month);
                return (
                  <td key={month} className="px-1 py-1 text-right whitespace-nowrap">
                    {editingKey === key ? (
                      <input
                        type="number"
                        autoFocus
                        className="w-24 border border-blue-400 rounded px-1 py-1 text-right"
                        value={draftValue}
                        onChange={(e) => setDraftValue(e.target.value)}
                        onBlur={() => commitEdit(row.assetId, month)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                          } else if (e.key === 'Escape') {
                            setEditingKey(null);
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="w-24 px-2 py-1 text-right hover:bg-blue-50 rounded"
                        onClick={() => startEdit(row.assetId, month, amount)}
                      >
                        {saving ? (
                          <span className="text-gray-400 text-xs">保存中...</span>
                        ) : (
                          formatYen(amount)
                        )}
                      </button>
                    )}
                  </td>
                );
              })}
              <td className="px-2 py-1 text-center whitespace-nowrap">
                <button
                  type="button"
                  className="text-xs text-red-500 hover:text-red-700 px-2"
                  onClick={() => onDelete(row.assetId, row.assetName)}
                >
                  削除
                </button>
              </td>
            </tr>
          ))}
          {ownerSubtotals.map((owner) => (
            <tr key={`subtotal-${owner.ownerUserId}`} className="bg-gray-50 font-medium">
              <td className="sticky left-0 bg-gray-50 z-10 px-3 py-2 whitespace-nowrap">
                {owner.displayName}計
              </td>
              {owner.months.map((amount, idx) => (
                <td key={idx} className="px-3 py-2 text-right whitespace-nowrap">
                  {formatYen(amount)}
                </td>
              ))}
              <td />
            </tr>
          ))}
          <tr className="bg-gray-50 font-bold">
            <td className="sticky left-0 bg-gray-50 z-10 px-3 py-2 whitespace-nowrap">合計</td>
            {total.map((amount, idx) => (
              <td key={idx} className="px-3 py-2 text-right whitespace-nowrap">
                {formatYen(amount)}
              </td>
            ))}
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
