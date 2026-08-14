import { OwnerSubtotalRow } from '../api/assetBalances';

interface Props {
  ownerSubtotals: OwnerSubtotalRow[];
  total: number[];
}

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
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
          {ownerSubtotals.map((owner) => (
            <tr key={owner.ownerUserId} className="border-b border-gray-100 dark:border-gray-700">
              <td className="sticky left-0 bg-white dark:bg-gray-800 z-10 px-3 py-2 whitespace-nowrap">
                {owner.displayName}計
              </td>
              {owner.months.map((amount, idx) => (
                <td key={idx} className="px-3 py-2 text-right whitespace-nowrap">
                  {formatYen(amount)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="bg-gray-50 dark:bg-gray-800 font-bold">
            <td className="sticky left-0 bg-gray-50 dark:bg-gray-800 z-10 px-3 py-2 whitespace-nowrap">純資産合計</td>
            {total.map((amount, idx) => (
              <td key={idx} className="px-3 py-2 text-right whitespace-nowrap">
                {formatYen(amount)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
