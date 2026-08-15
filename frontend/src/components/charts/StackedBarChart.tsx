import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useTheme } from '../../hooks/useTheme';
import { getChartThemeColors } from './chartTheme';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface BarDataset {
  label: string;
  data: number[];
  backgroundColor?: string;
}

interface Props {
  labels: string[];
  datasets: BarDataset[];
}

export function StackedBarChart({ labels, datasets }: Props) {
  const { theme } = useTheme();
  const { textColor, gridColor } = getChartThemeColors(theme);

  return (
    <Bar
      data={{
        labels,
        datasets,
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor } },
        },
        scales: {
          x: { stacked: true, ticks: { color: textColor }, grid: { color: gridColor } },
          y: { stacked: true, ticks: { color: textColor }, grid: { color: gridColor } },
        },
      }}
    />
  );
}
