"use client";

import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function CategoryPieChart({ data }: { data: { category: string; expense: number }[] }) {
  const labels = data.map((d) => d.category);
  const values = data.map((d) => d.expense);

  return (
    <Pie
      data={{
        labels,
        datasets: [
          {
            label: 'カテゴリ別支出',
            data: values,
            backgroundColor: [
              '#F44336', '#2196F3', '#4CAF50', '#FF9800',
              '#9C27B0', '#00BCD4', '#8BC34A'
            ]
          }
        ]
      }}
    />
  );
}
