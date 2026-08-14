import { AnnualSummaryRow } from '../api/summary';

interface Props {
  rows: AnnualSummaryRow[];
}

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

interface UserTotal {
  userId: string;
  displayName: string;
  months: number[];
  annualTotal: number;
}

export function AnnualCrossTable({ rows }: Props) {
  const totalMonths = new Array(12).fill(0);
  let totalAnnual = 0;
  const userTotals = new Map<string, UserTotal>();
  for (const row of rows) {
    row.months.forEach((amount, i) => {
      totalMonths[i] += amount;
    });
    totalAnnual += row.annualTotal;

    let userTotal = userTotals.get(row.userId);
    if (!userTotal) {
      userTotal = {
        userId: row.userId,
        displayName: row.displayName,
        months: new Array(12).fill(0),
        annualTotal: 0,
      };
      userTotals.set(row.userId, userTotal);
    }
    row.months.forEach((amount, i) => {
      userTotal!.months[i] += amount;
    });
    userTotal.annualTotal += row.annualTotal;
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="sticky left-0 bg-gray-50 z-10 px-3 py-2 text-left font-medium text-gray-500 border-b border-gray-200 whitespace-nowrap">
              費目
            </th>
            {MONTH_LABELS.map((label) => (
              <th
                key={label}
                className="px-3 py-2 text-right font-medium text-gray-500 border-b border-gray-200 whitespace-nowrap"
              >
                {label}
              </th>
            ))}
            <th className="px-3 py-2 text-right font-medium text-gray-500 border-b border-gray-200 whitespace-nowrap">
              年間合計
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.categoryName}-${row.userId}`} className="border-b border-gray-100">
              <td className="sticky left-0 bg-white z-10 px-3 py-2 whitespace-nowrap">
                {row.categoryName}({row.displayName})
              </td>
              {row.months.map((amount, i) => (
                <td key={i} className="px-3 py-2 text-right whitespace-nowrap">
                  {formatYen(amount)}
                </td>
              ))}
              <td className="px-3 py-2 text-right font-medium whitespace-nowrap">
                {formatYen(row.annualTotal)}
              </td>
            </tr>
          ))}
          {Array.from(userTotals.values()).map((userTotal) => (
            <tr key={`total-${userTotal.userId}`} className="bg-gray-50 font-medium">
              <td className="sticky left-0 bg-gray-50 z-10 px-3 py-2 whitespace-nowrap">
                合計（{userTotal.displayName}）
              </td>
              {userTotal.months.map((amount, i) => (
                <td key={i} className="px-3 py-2 text-right whitespace-nowrap">
                  {formatYen(amount)}
                </td>
              ))}
              <td className="px-3 py-2 text-right whitespace-nowrap">{formatYen(userTotal.annualTotal)}</td>
            </tr>
          ))}
          <tr className="bg-gray-50 font-bold">
            <td className="sticky left-0 bg-gray-50 z-10 px-3 py-2 whitespace-nowrap">合計</td>
            {totalMonths.map((amount, i) => (
              <td key={i} className="px-3 py-2 text-right whitespace-nowrap">
                {formatYen(amount)}
              </td>
            ))}
            <td className="px-3 py-2 text-right whitespace-nowrap">{formatYen(totalAnnual)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
