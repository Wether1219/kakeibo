import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useTheme } from '../../hooks/useTheme';
import { getChartThemeColors } from './chartTheme';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

interface LineDataset {
  label: string;
  data: number[];
  borderColor?: string;
  backgroundColor?: string;
  tension?: number;
  borderDash?: number[];
  pointRadius?: number;
}

interface Props {
  labels: string[];
  datasets: LineDataset[];
  options?: ChartOptions<'line'>;
}

export function LineChart({ labels, datasets, options }: Props) {
  const { theme } = useTheme();
  const { textColor, gridColor } = getChartThemeColors(theme);

  return (
    <Line
      data={{
        labels,
        datasets: datasets.map((d) => ({
          tension: 0.3,
          ...d,
        })),
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor } },
        },
        scales: {
          x: { ticks: { color: textColor }, grid: { color: gridColor } },
          y: { ticks: { color: textColor }, grid: { color: gridColor } },
        },
        // ...optionsは末尾にあるため、将来呼び出し元がscales/pluginsを渡す場合は
        // このテーマデフォルトを浅いマージで上書きすることになる点に注意。
        ...options,
      }}
    />
  );
}
