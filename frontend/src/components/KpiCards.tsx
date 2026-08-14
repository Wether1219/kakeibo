import { VisualizationMember } from '../api/summary';

interface Props {
  members: VisualizationMember[];
}

const EXPENSE_RATIO_TARGET = 60;
const SAVING_RATIO_TARGET = 40;

function ratioBadgeClass(hasIncome: boolean, isGood: boolean): string {
  if (!hasIncome) return 'bg-gray-100 text-gray-500';
  return isGood ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
}

function formatRatio(hasIncome: boolean, ratio: number): string {
  return hasIncome ? `${ratio.toFixed(1)}%` : '-';
}

export function KpiCards({ members }: Props) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold text-gray-600">KPIカード</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {members.map((m) => {
          const hasIncome = m.annual.income !== 0;
          const expenseIsGood = m.expenseRatio <= EXPENSE_RATIO_TARGET;
          const savingIsGood = m.savingRatio >= SAVING_RATIO_TARGET;
          return (
            <div key={m.userId} className="rounded border border-gray-200 bg-white p-4 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-gray-500">{m.displayName}</h3>
              <div className={`rounded px-3 py-2 ${ratioBadgeClass(hasIncome, expenseIsGood)}`}>
                <div className="text-xs">支出率</div>
                <div className="text-lg font-bold">{formatRatio(hasIncome, m.expenseRatio)}</div>
              </div>
              <div className={`rounded px-3 py-2 ${ratioBadgeClass(hasIncome, savingIsGood)}`}>
                <div className="text-xs">貯蓄率</div>
                <div className="text-lg font-bold">{formatRatio(hasIncome, m.savingRatio)}</div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-400">
        目標: 支出率{EXPENSE_RATIO_TARGET}%以下 / 貯蓄率{SAVING_RATIO_TARGET}%以上
      </p>
    </section>
  );
}
