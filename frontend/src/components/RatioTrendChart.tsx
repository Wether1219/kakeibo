import { VisualizationMember } from '../api/summary';
import { LineChart } from './charts/LineChart';

interface Props {
  members: VisualizationMember[];
}

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const SERIES_COLORS = ['#4C6EF5', '#F76707', '#12B886', '#E64980'];
const EXPENSE_RATIO_TARGET = 60;
const SAVING_RATIO_TARGET = 40;

export function RatioTrendChart({ members }: Props) {
  const datasets = members.flatMap((m, i) => {
    const color = SERIES_COLORS[i % SERIES_COLORS.length];
    const sortedRatios = [...m.monthlyRatios].sort((a, b) => a.month - b.month);
    return [
      {
        label: `${m.displayName} 支出率`,
        data: sortedRatios.map((r) => r.expenseRatio),
        borderColor: color,
        backgroundColor: color,
      },
      {
        label: `${m.displayName} 貯蓄率`,
        data: sortedRatios.map((r) => r.savingRatio),
        borderColor: color,
        backgroundColor: color,
        borderDash: [6, 4],
      },
    ];
  });

  const targetDatasets = [
    {
      label: `目標支出率${EXPENSE_RATIO_TARGET}%`,
      data: new Array(12).fill(EXPENSE_RATIO_TARGET),
      borderColor: '#9CA3AF',
      backgroundColor: '#9CA3AF',
      borderDash: [2, 2],
      pointRadius: 0,
    },
    {
      label: `目標貯蓄率${SAVING_RATIO_TARGET}%`,
      data: new Array(12).fill(SAVING_RATIO_TARGET),
      borderColor: '#D1D5DB',
      backgroundColor: '#D1D5DB',
      borderDash: [2, 2],
      pointRadius: 0,
    },
  ];

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold text-gray-600">月別 支出率・貯蓄率 推移</h2>
      <div className="h-64">
        <LineChart labels={MONTH_LABELS} datasets={[...datasets, ...targetDatasets]} />
      </div>
    </section>
  );
}
