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
          legend: { position: 'bottom' },
        },
        ...options,
      }}
    />
  );
}
