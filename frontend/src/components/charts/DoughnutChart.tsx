import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { useTheme } from '../../hooks/useTheme';
import { getChartThemeColors } from './chartTheme';

ChartJS.register(ArcElement, Tooltip, Legend);

interface Props {
  labels: string[];
  data: number[];
  colors: string[];
}

export function DoughnutChart({ labels, data, colors }: Props) {
  const { theme } = useTheme();
  const { textColor } = getChartThemeColors(theme);

  return (
    <Doughnut
      data={{
        labels,
        datasets: [
          {
            data,
            backgroundColor: colors,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor } },
        },
      }}
    />
  );
}
