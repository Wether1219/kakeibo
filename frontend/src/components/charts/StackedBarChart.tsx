import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

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
          legend: { position: 'bottom' },
        },
        scales: {
          x: { stacked: true },
          y: { stacked: true },
        },
      }}
    />
  );
}
