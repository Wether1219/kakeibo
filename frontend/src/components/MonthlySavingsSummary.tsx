import { Fragment } from 'react';
import { AnnualSummaryRow } from '../api/summary';

interface Props {
  rows: AnnualSummaryRow[];
}

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

function formatPercent(ratio: number): string {
  return `${ratio.toFixed(1)}%`;
}

// ゼロ除算ガード（docs/03_詳細設計書.md 5.4節のIFERROR(...,0)相当）。
function calculateRatio(saving: number, income: number): number {
  if (income === 0) return 0;
  return (saving / income) * 100;
}

// 貯金合計(e) = 先取り貯金(b) + 余り貯金(d)。d = 収入(a) - 先取り貯金(b) - 支出(c) のため、
// 式を展開すると e = 収入(a) - 支出(c) となる（docs/03_詳細設計書.md 5.3節と同一ロジック）。
export function calculateMonthlyTotalSaving(rows: AnnualSummaryRow[], userId: string): number[] {
  const months = new Array(12).fill(0);
  for (const row of rows) {
    if (row.userId !== userId) continue;
    const sign = row.categoryType === 'income' ? 1 : row.categoryType === 'pre_saving' ? 0 : -1;
    if (sign === 0) continue;
    row.months.forEach((amount, i) => {
      months[i] += sign * amount;
    });
  }
  return months;
}

export function calculateMonthlyIncome(rows: AnnualSummaryRow[], userId: string): number[] {
  const months = new Array(12).fill(0);
  for (const row of rows) {
    if (row.userId !== userId || row.categoryType !== 'income') continue;
    row.months.forEach((amount, i) => {
      months[i] += amount;
    });
  }
  return months;
}

export function MonthlySavingsSummary({ rows }: Props) {
  const users = getUsersFromRows(rows);

  const userMonths = users.map((u) => {
    const months = calculateMonthlyTotalSaving(rows, u.userId);
    const income = calculateMonthlyIncome(rows, u.userId);
    const ratio = months.map((saving, i) => calculateRatio(saving, income[i]));
    return { ...u, months, income, ratio };
  });

  const totalMonths = new Array(12).fill(0);
  const totalIncome = new Array(12).fill(0);
  for (const u of userMonths) {
    u.months.forEach((amount, i) => {
      totalMonths[i] += amount;
    });
    u.income.forEach((amount, i) => {
      totalIncome[i] += amount;
    });
  }
  const totalRatio = totalMonths.map((saving, i) => calculateRatio(saving, totalIncome[i]));

  const sumArray = (values: number[]) => values.reduce((sum, v) => sum + v, 0);

  return (
    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800">
            <th className="sticky left-0 bg-gray-50 dark:bg-gray-800 z-10 px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap">
              貯金合計
            </th>
            {MONTH_LABELS.map((label) => (
              <th
                key={label}
                className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap"
              >
                {label}
              </th>
            ))}
            <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap">
              年間合計
            </th>
          </tr>
        </thead>
        <tbody>
          {userMonths.map((u) => (
            <Fragment key={u.userId}>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <td className="sticky left-0 bg-white dark:bg-gray-800 z-10 px-3 py-2 whitespace-nowrap">
                  {u.displayName}
                </td>
                {u.months.map((amount, i) => (
                  <td
                    key={i}
                    className={`px-3 py-2 text-right whitespace-nowrap ${amount < 0 ? 'text-red-600 dark:text-red-400' : ''}`}
                  >
                    {formatYen(amount)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-medium whitespace-nowrap">
                  {formatYen(sumArray(u.months))}
                </td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-xs">
                <td className="sticky left-0 bg-white dark:bg-gray-800 z-10 px-3 py-1 pl-6 whitespace-nowrap">
                  貯蓄率
                </td>
                {u.ratio.map((ratio, i) => (
                  <td
                    key={i}
                    className={`px-3 py-1 text-right whitespace-nowrap ${ratio < 0 ? 'text-red-600 dark:text-red-400' : ''}`}
                  >
                    {formatPercent(ratio)}
                  </td>
                ))}
                <td className="px-3 py-1 text-right whitespace-nowrap">
                  {formatPercent(calculateRatio(sumArray(u.months), sumArray(u.income)))}
                </td>
              </tr>
            </Fragment>
          ))}
          <tr className="bg-gray-50 dark:bg-gray-800 font-bold">
            <td className="sticky left-0 bg-gray-50 dark:bg-gray-800 z-10 px-3 py-2 whitespace-nowrap">合計</td>
            {totalMonths.map((amount, i) => (
              <td
                key={i}
                className={`px-3 py-2 text-right whitespace-nowrap ${amount < 0 ? 'text-red-600 dark:text-red-400' : ''}`}
              >
                {formatYen(amount)}
              </td>
            ))}
            <td className="px-3 py-2 text-right whitespace-nowrap">
              {formatYen(sumArray(totalMonths))}
            </td>
          </tr>
          <tr className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs">
            <td className="sticky left-0 bg-gray-50 dark:bg-gray-800 z-10 px-3 py-1 pl-6 whitespace-nowrap">
              貯蓄率
            </td>
            {totalRatio.map((ratio, i) => (
              <td
                key={i}
                className={`px-3 py-1 text-right whitespace-nowrap ${ratio < 0 ? 'text-red-600 dark:text-red-400' : ''}`}
              >
                {formatPercent(ratio)}
              </td>
            ))}
            <td className="px-3 py-1 text-right whitespace-nowrap">
              {formatPercent(calculateRatio(sumArray(totalMonths), sumArray(totalIncome)))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function getUsersFromRows(rows: AnnualSummaryRow[]): { userId: string; displayName: string }[] {
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.userId, row.displayName);
  }
  return Array.from(map, ([userId, displayName]) => ({ userId, displayName }));
}
