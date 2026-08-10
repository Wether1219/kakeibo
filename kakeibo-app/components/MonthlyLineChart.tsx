 'use client';

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function MonthlyLineChart({ data }: any) {
  const labels = data.map((d: any) => d.month);
  const income = data.map((d: any) => d.income);
  const expense = data.map((d: any) => d.expense);

  return (
    <Line
      data={{
        labels,
        datasets: [
          {
            label: '収入',
            data: income,
            borderColor: '#4CAF50',
            fill: false
          },
          {
            label: '支出',
            data: expense,
            borderColor: '#F44336',
            fill: false
          }
        ]
      }}
    />
  );
}
