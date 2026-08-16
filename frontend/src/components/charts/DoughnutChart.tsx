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
          legend: {
            position: 'bottom',
            labels: {
              color: textColor,
              generateLabels: (chart) => {
                const { data } = chart;
                const values = (data.datasets[0]?.data ?? []) as number[];
                const total = values.reduce((sum, v) => sum + v, 0);
                return (data.labels ?? []).map((label, i) => {
                  const value = values[i] ?? 0;
                  const percent = total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
                  return {
                    text: `${label} (${percent}%)`,
                    fillStyle: colors[i % colors.length],
                    strokeStyle: colors[i % colors.length],
                    fontColor: textColor,
                    index: i,
                  };
                });
              },
            },
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const values = (context.dataset.data ?? []) as number[];
                const total = values.reduce((sum, v) => sum + v, 0);
                const value = values[context.dataIndex] ?? 0;
                const percent = total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
                return `${context.label}: ${value.toLocaleString()}円 (${percent}%)`;
              },
            },
          },
        },
      }}
    />
  );
}
