import { useState } from 'react';
import { VisualizationCategoryAmount, VisualizationMember } from '../api/summary';

interface Props {
  members: VisualizationMember[];
}

function formatYen(amount: number): string {
  return `¥${Math.round(amount).toLocaleString('ja-JP')}`;
}

function CategoryRows({
  categories,
  visible,
}: {
  categories: VisualizationCategoryAmount[];
  visible: boolean;
}) {
  if (!visible || categories.length === 0) return null;
  return (
    <>
      {categories.map((c) => (
        <div key={c.categoryId} className="flex justify-between pl-3 text-xs text-gray-400 dark:text-gray-500">
          <dt>
            {c.icon ?? ''}
            {c.name}
          </dt>
          <dd>{formatYen(c.amount)}</dd>
        </div>
      ))}
    </>
  );
}

export function AverageBalanceSection({ members }: Props) {
  const [showCategories, setShowCategories] = useState(false);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-600 dark:text-gray-400">月平均の収支（毎月発生するもの）</h2>
        <button
          type="button"
          className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
          onClick={() => setShowCategories((prev) => !prev)}
        >
          {showCategories ? '費目を非表示' : '費目を表示'}
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {members.map((m) => (
          <div key={m.userId} className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3">{m.displayName}</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">収入</dt>
                <dd className="font-medium">{formatYen(m.monthlyAverage.income)}</dd>
              </div>
              <CategoryRows categories={m.monthlyAverage.incomeByCategory} visible={showCategories} />

              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">先取り貯金</dt>
                <dd className="font-medium">{formatYen(m.monthlyAverage.preSaving)}</dd>
              </div>
              <CategoryRows categories={m.monthlyAverage.preSavingByCategory} visible={showCategories} />

              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">固定費</dt>
                <dd className="font-medium">{formatYen(m.monthlyAverage.fixedExpense)}</dd>
              </div>
              <CategoryRows categories={m.monthlyAverage.fixedExpenseByCategory} visible={showCategories} />

              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">変動費</dt>
                <dd className="font-medium">{formatYen(m.monthlyAverage.variableExpense)}</dd>
              </div>
              <CategoryRows categories={m.monthlyAverage.variableExpenseByCategory} visible={showCategories} />

              <div className="flex justify-between border-t border-gray-100 dark:border-gray-700 pt-2">
                <dt className="text-gray-500 dark:text-gray-400">余り貯金</dt>
                <dd className={`font-bold ${m.monthlyAverage.remainingSaving < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                  {formatYen(m.monthlyAverage.remainingSaving)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">貯金合計</dt>
                <dd className="font-bold">{formatYen(m.monthlyAverage.totalSaving)}</dd>
              </div>
            </dl>
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between text-sm bg-amber-50 dark:bg-amber-950 -mx-4 -mb-4 px-4 py-2 rounded-b">
              <dt className="text-gray-500 dark:text-gray-400"><span aria-hidden="true">💰</span>賞与（年間合計÷2）</dt>
              <dd className="font-medium">{formatYen(m.bonusAverage)}</dd>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
