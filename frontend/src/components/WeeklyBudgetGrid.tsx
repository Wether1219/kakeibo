import { Fragment } from 'react';
import type { WeeklyBudgetCategory } from '../hooks/useWeeklyBudgetForm';

interface Props {
  categories: WeeklyBudgetCategory[];
  weeks: number[];
  budgets: Record<string, number>;
  actuals: Record<string, number>;
  onBudgetChange: (weekNo: number, categoryId: string, amount: number) => void;
}

export function WeeklyBudgetGrid({ categories, weeks, budgets, actuals, onBudgetChange }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-gray-200 dark:border-gray-700 text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800">
            <th rowSpan={2} className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700 align-bottom">
              費目
            </th>
            {weeks.map((w) => (
              <th key={w} colSpan={2} className="px-3 py-2 text-center border-b border-gray-200 dark:border-gray-700">
                第{w}週
              </th>
            ))}
          </tr>
          <tr className="bg-gray-50 dark:bg-gray-800">
            {weeks.map((w) => (
              <Fragment key={w}>
                <th className="px-3 py-1 text-right border-b border-gray-200 dark:border-gray-700 font-normal text-xs text-gray-500 dark:text-gray-400" style={{ paddingRight: '3em' }}>
                  予算
                </th>
                <th className="px-3 py-1 text-right border-b border-gray-200 dark:border-gray-700 font-normal text-xs text-gray-500 dark:text-gray-400">
                  実績(差額)
                </th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id} className="border-b border-gray-100 dark:border-gray-700">
              <td className="px-3 py-2 whitespace-nowrap">
                {c.icon} {c.name}
              </td>
              {weeks.map((w) => {
                const key = `${w}:${c.id}`;
                const actual = actuals[key] ?? 0;
                const budget = budgets[key] ?? 0;
                const diff = budget - actual;
                return (
                  <Fragment key={w}>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        className="w-20 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1 text-right"
                        value={budget}
                        onChange={(e) => onBudgetChange(w, c.id, Number(e.target.value))}
                      />
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <span>{actual.toLocaleString()}</span>
                      <span className={`ml-1 text-xs ${diff < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>
                        ({diff >= 0 ? '+' : ''}
                        {diff.toLocaleString()})
                      </span>
                    </td>
                  </Fragment>
                );
              })}
            </tr>
          ))}
          {categories.length === 0 && (
            <tr>
              <td className="px-3 py-4 text-gray-400 dark:text-gray-500" colSpan={weeks.length * 2 + 1}>
                変動費費目がありません（費目マスタで登録してください）
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
