import { VisualizationMember } from '../api/summary';
import { BalanceSummaryCard } from './BalanceSummaryCard';

interface Props {
  members: VisualizationMember[];
}

export function AnnualBalanceSection({ members }: Props) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold text-gray-600">年間の収支（臨時含む）</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {members.map((m) => (
          <BalanceSummaryCard
            key={m.userId}
            displayName={m.displayName}
            income={m.annual.income}
            preSaving={m.annual.preSaving}
            expense={m.annual.expense}
            remainingSaving={m.annual.remainingSaving}
            totalSaving={m.annual.totalSaving}
          />
        ))}
      </div>
    </section>
  );
}
