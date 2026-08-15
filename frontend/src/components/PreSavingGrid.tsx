import { Fragment } from 'react';
import type { Category } from '../api/categories';
import type { User } from '../api/users';

interface Props {
  categories: Category[];
  users: User[];
  budgets: Record<string, number>;
  actuals: Record<string, number>;
  onBudgetChange: (userId: string, categoryId: string, amount: number) => void;
  onActualChange: (userId: string, categoryId: string, amount: number) => void;
}

export function PreSavingGrid({
  categories,
  users,
  budgets,
  actuals,
  onBudgetChange,
  onActualChange,
}: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-gray-200 dark:border-gray-700 text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800">
            <th rowSpan={2} className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700 align-bottom">
              費目
            </th>
            {users.map((u) => (
              <th
                key={u.id}
                colSpan={2}
                className="px-3 py-2 text-center border-b border-gray-200 dark:border-gray-700"
                style={{ paddingRight: '4em' }}
              >
                {u.displayName}
              </th>
            ))}
          </tr>
          <tr className="bg-gray-50 dark:bg-gray-800">
            {users.map((u) => (
              <Fragment key={u.id}>
                <th className="px-3 py-1 text-right border-b border-gray-200 dark:border-gray-700 font-normal text-xs text-gray-500 dark:text-gray-400">
                  予算
                </th>
                <th className="px-3 py-1 text-right border-b border-gray-200 dark:border-gray-700 font-normal text-xs text-gray-500 dark:text-gray-400">
                  実績
                </th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id} className="border-b border-gray-100 dark:border-gray-700">
              <td className="px-3 py-2">
                {c.icon} {c.name}
              </td>
              {users.map((u) => {
                const key = `${u.id}:${c.id}`;
                return (
                  <Fragment key={u.id}>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        className="w-24 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1 text-right"
                        value={budgets[key] ?? 0}
                        onChange={(e) => onBudgetChange(u.id, c.id, Number(e.target.value))}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        className="w-24 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1 text-right"
                        value={actuals[key] ?? 0}
                        onChange={(e) => onActualChange(u.id, c.id, Number(e.target.value))}
                      />
                    </td>
                  </Fragment>
                );
              })}
            </tr>
          ))}
          {categories.length === 0 && (
            <tr>
              <td className="px-3 py-4 text-gray-400 dark:text-gray-500" colSpan={users.length * 2 + 1}>
                先取り貯金・投資費目がありません（費目マスタで登録してください）
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
