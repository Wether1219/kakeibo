"use client";

import { useEffect, useState } from 'react';
import MonthlyChart from '@/components/MonthlyChart';
import CategoryPieChart from '@/components/CategoryPieChart';
import MonthlyLineChart from '@/components/MonthlyLineChart';
import ExportAndDeleteButton from '@/components/ExportAndDeleteButton';

export default function Home() {
  const [summary, setSummary] = useState<{ income: number; expense: number; balance: number } | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categorySummary, setCategorySummary] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/summary')
      .then(res => res.json())
      .then(data => {
        setSummary(data ?? null);
      })
      .catch(() => setSummary(null));

    fetch('/api/transactions')
      .then(res => res.json())
      .then(data => setTransactions(Array.isArray(data) ? data : []))
      .catch(() => setTransactions([]));

    fetch('/api/category-summary')
      .then(res => res.json())
      .then(data => setCategorySummary(Array.isArray(data) ? data : []))
      .catch(() => setCategorySummary([]));

    fetch('/api/monthly')
      .then(res => res.json())
      .then(data => setMonthlyData(Array.isArray(data) ? data : []))
      .catch(() => setMonthlyData([]));
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>家計簿ダッシュボード</h1>

      {summary && (
        <div>
          <h2>今月のサマリ</h2>
          <p>収入: {summary.income ?? 0} 円</p>
          <p>支出: {summary.expense ?? 0} 円</p>
          <p>残高: {summary.balance ?? 0} 円</p>
          <MonthlyChart income={summary.income} expense={summary.expense} />
        </div>
      )}

      {categorySummary.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2>カテゴリ別支出割合</h2>
          <CategoryPieChart data={categorySummary} />
        </div>
      )}

      {monthlyData.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2>月次推移（収入・支出）</h2>
          <MonthlyLineChart data={monthlyData} />
        </div>
      )}

      <h2>取引一覧</h2>
      <ul>
        {transactions.map((t: any) => (
          <li key={t.id}>
            {t.created_at ?? t.date} / {t.category} / {t.type} / {t.amount}円
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <a href="/add">
          <button>収支を追加する</button>
        </a>
        <a href="/api/export">
          <button>Excel出力</button>
        </a>
        <a href="/api/export">
          <button>Excel出力（高度版）</button>
        </a>
        <ExportAndDeleteButton />
      </div>
    </div>
  );
}
