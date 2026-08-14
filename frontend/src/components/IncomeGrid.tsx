import type { Category } from '../api/categories';
import type { User } from '../api/users';

interface Props {
  categories: Category[];
  users: User[];
  values: Record<string, number>;
  onChange: (userId: string, categoryId: string, amount: number) => void;
}

export function IncomeGrid({ categories, users, values, onChange }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-gray-200 dark:border-gray-700 text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800">
            <th className="px-3 py-2 text-left border-b border-gray-200 dark:border-gray-700">費目</th>
            {users.map((u) => (
              <th key={u.id} className="px-3 py-2 text-right border-b border-gray-200 dark:border-gray-700">
                {u.displayName}
              </th>
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
                  <td key={u.id} className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      className="w-28 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1 text-right"
                      value={values[key] ?? 0}
                      onChange={(e) => onChange(u.id, c.id, Number(e.target.value))}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
          {categories.length === 0 && (
            <tr>
              <td className="px-3 py-4 text-gray-400 dark:text-gray-500" colSpan={users.length + 1}>
                収入費目がありません（費目マスタで登録してください）
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
