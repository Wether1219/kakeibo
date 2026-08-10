"use client";

import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function MonthlyChart({ income, expense }: { income: number; expense: number }) {
  const data = {
    labels: ['収入', '支出'],
    datasets: [
      {
        label: '今月の収支',
        data: [income, expense],
        backgroundColor: ['#4CAF50', '#F44336']
      }
    ]
  };

  return (
    <div style={{ width: '400px', marginTop: 20 }}>
      <Bar data={data} />
    </div>
  );
}
