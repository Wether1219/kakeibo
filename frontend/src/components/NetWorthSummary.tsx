import { Fragment } from 'react';
import { OwnerSubtotalRow } from '../api/assetBalances';

interface Props {
  ownerSubtotals: OwnerSubtotalRow[];
  total: number[];
}

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

function formatDiff(diff: number | null): string {
  if (diff === null) return '-';
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff.toLocaleString('ja-JP')}`;
}

// 1月は前年12月のデータを保持していないため差分なし（null）とする
function calcMonthDiffs(months: number[]): (number | null)[] {
  return months.map((amount, idx) => (idx === 0 ? null : amount - months[idx - 1]));
}

// 純資産 = 現金・預貯金 + 証券・株式 + 保険の合計（全区分の名義人別小計・世帯合計をそのまま利用）
export function NetWorthSummary({ ownerSubtotals, total }: Props) {
  return (
    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800">
            <th className="sticky left-0 bg-gray-50 dark:bg-gray-800 z-10 px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap">
              名称
            </th>
            {MONTH_LABELS.map((label) => (
              <th
                key={label}
                className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ownerSubtotals.map((owner) => {
            const diffs = calcMonthDiffs(owner.months);
            return (
              <Fragment key={owner.ownerUserId}>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <td className="sticky left-0 bg-white dark:bg-gray-800 z-10 px-3 py-2 whitespace-nowrap">
                    {owner.displayName}計
                  </td>
                  {owner.months.map((amount, idx) => (
                    <td key={idx} className="px-3 py-2 text-right whitespace-nowrap">
                      {formatYen(amount)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                  <td className="sticky left-0 bg-white dark:bg-gray-800 z-10 px-3 py-1 whitespace-nowrap">
                    {owner.displayName}計 前月差
                  </td>
                  {diffs.map((diff, idx) => (
                    <td
                      key={idx}
                      className={`px-3 py-1 text-right whitespace-nowrap ${diff !== null && diff < 0 ? 'text-red-600 dark:text-red-400' : ''}`}
                    >
                      {formatDiff(diff)}
                    </td>
                  ))}
                </tr>
              </Fragment>
            );
          })}
          <tr className="bg-gray-50 dark:bg-gray-800 font-bold">
            <td className="sticky left-0 bg-gray-50 dark:bg-gray-800 z-10 px-3 py-2 whitespace-nowrap">純資産合計</td>
            {total.map((amount, idx) => (
              <td key={idx} className="px-3 py-2 text-right whitespace-nowrap">
                {formatYen(amount)}
              </td>
            ))}
          </tr>
          <tr className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
            <td className="sticky left-0 bg-gray-50 dark:bg-gray-800 z-10 px-3 py-1 whitespace-nowrap">純資産合計 前月差</td>
            {calcMonthDiffs(total).map((diff, idx) => (
              <td
                key={idx}
                className={`px-3 py-1 text-right whitespace-nowrap ${diff !== null && diff < 0 ? 'text-red-600 dark:text-red-400' : ''}`}
              >
                {formatDiff(diff)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
