import { useState } from 'react';
import { MonthlySummaryCategoryRow } from '../api/summary';
import { FIXED_EXPENSE_COLORS, VARIABLE_EXPENSE_COLORS } from '../constants/categoryColors';
import { DoughnutChart } from './charts/DoughnutChart';

interface Member {
  userId: string;
  displayName: string;
}

interface Props {
  members: Member[];
  fixedExpenseByCategory: MonthlySummaryCategoryRow[];
  variableExpenseByCategory: MonthlySummaryCategoryRow[];
}

const TOTAL_KEY = 'total' as const;
type ActiveKey = string | typeof TOTAL_KEY;

export function sumAmounts(amounts: Record<string, number>): number {
  return Object.values(amounts).reduce((sum, v) => sum + v, 0);
}

function toChartData(rows: MonthlySummaryCategoryRow[], activeKey: ActiveKey, palette: readonly string[]) {
  const labels = rows.map((r) => `${r.icon ?? ''}${r.name}`);
  const data = rows.map((r) => (activeKey === TOTAL_KEY ? sumAmounts(r.amounts) : r.amounts[activeKey] ?? 0));
  const colors = rows.map((_, i) => palette[i % palette.length]);
  return { labels, data, colors };
}

export function ExpensePieCharts({ members, fixedExpenseByCategory, variableExpenseByCategory }: Props) {
  const [activeKey, setActiveKey] = useState<ActiveKey | undefined>(members[0]?.userId);
  const currentKey: ActiveKey = activeKey ?? members[0]?.userId ?? TOTAL_KEY;

  const fixed = toChartData(fixedExpenseByCategory, currentKey, FIXED_EXPENSE_COLORS);
  const variable = toChartData(variableExpenseByCategory, currentKey, VARIABLE_EXPENSE_COLORS);

  return (
    <section>
      <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2">支出内訳</h2>
      <div className="flex gap-1 mb-3">
        {members.map((m) => (
          <button
            key={m.userId}
            type="button"
            onClick={() => setActiveKey(m.userId)}
            className={`px-3 py-1 text-sm rounded ${
              currentKey === m.userId
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {m.displayName}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setActiveKey(TOTAL_KEY)}
          className={`px-3 py-1 text-sm rounded ${
            currentKey === TOTAL_KEY
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          世帯合計
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
          <h3 className="text-xs text-gray-500 dark:text-gray-400 mb-2">固定費</h3>
          <div className="h-56">
            <DoughnutChart labels={fixed.labels} data={fixed.data} colors={fixed.colors} />
          </div>
        </div>
        <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
          <h3 className="text-xs text-gray-500 dark:text-gray-400 mb-2">変動費</h3>
          <div className="h-56">
            <DoughnutChart labels={variable.labels} data={variable.data} colors={variable.colors} />
          </div>
        </div>
      </div>
    </section>
  );
}
