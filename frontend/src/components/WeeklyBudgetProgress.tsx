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

  return (
    <section>
      <h2 className="text-sm font-bold text-gray-500 mb-2">週次予算 消化状況</h2>
      <div className="rounded border border-gray-200 bg-white p-4 space-y-3">
        {totals.length === 0 && <p className="text-sm text-gray-400">予算が設定されていません</p>}
        {totals.map((c) => {
          const ratio = c.budgetAmount > 0 ? (c.actualAmount / c.budgetAmount) * 100 : 0;
          const over = c.actualAmount > c.budgetAmount;
          return (
            <div key={c.categoryId}>
              <div className="flex justify-between text-sm mb-1">
                <span>
                  {c.icon ?? ''}
                  {c.name}
                </span>
                <span className={over ? 'text-red-600 font-bold' : 'text-gray-600'}>
                  {formatYen(c.actualAmount)}/{formatYen(c.budgetAmount)}
                </span>
              </div>
              <div className="h-2 rounded bg-gray-100 overflow-hidden">
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
