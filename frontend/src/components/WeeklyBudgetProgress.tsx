import { WeeklyBudgetWithActual } from '../api/weeklyBudgets';

interface Props {
  rows: WeeklyBudgetWithActual[];
}

interface CategoryTotal {
  categoryId: string;
  name: string;
  icon: string | null;
  budgetAmount: number;
  actualAmount: number;
}

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

function aggregateByCategory(rows: WeeklyBudgetWithActual[]): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();
  for (const row of rows) {
    const existing = map.get(row.categoryId);
    if (existing) {
      existing.budgetAmount += row.budgetAmount;
      existing.actualAmount += row.actualAmount;
    } else {
      map.set(row.categoryId, {
        categoryId: row.categoryId,
        name: row.categoryName,
        icon: row.categoryIcon,
        budgetAmount: row.budgetAmount,
        actualAmount: row.actualAmount,
      });
    }
  }
  return Array.from(map.values()).filter((c) => c.budgetAmount > 0);
}

export function WeeklyBudgetProgress({ rows }: Props) {
  const totals = aggregateByCategory(rows);
  const overCount = totals.filter((c) => c.actualAmount > c.budgetAmount).length;

  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400">週次予算 消化状況</h2>
        {overCount > 0 && (
          <span className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded px-2 py-0.5">
            {overCount}件超過
          </span>
        )}
      </div>
      <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
        {totals.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500">予算が設定されていません</p>}
        {totals.map((c) => {
          const ratio = c.budgetAmount > 0 ? (c.actualAmount / c.budgetAmount) * 100 : 0;
          const over = c.actualAmount > c.budgetAmount;
          return (
            <div key={c.categoryId}>
              <div className="flex justify-between items-center text-sm mb-1">
                <span className="flex items-center gap-1">
                  {c.icon ?? ''}
                  {c.name}
                  {over && (
                    <span className="text-[10px] font-bold text-white bg-red-500 rounded px-1.5 py-0.5">
                      超過
                    </span>
                  )}
                </span>
                <span className={over ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-600 dark:text-gray-400'}>
                  {formatYen(c.actualAmount)}/{formatYen(c.budgetAmount)}
                </span>
              </div>
              <div className="h-2 rounded bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div
                  className={`h-full ${over ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(100, ratio)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
