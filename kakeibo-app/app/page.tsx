"use client";

import { useEffect, useState } from 'react';

export default function Home() {
  const [summary, setSummary] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/summary')
      .then(res => res.json())
      .then(data => {
        // API がオブジェクトで返す想定（{ income, expense, balance }）
        setSummary(data ?? null);
      })
      .catch(() => setSummary(null));

    fetch('/api/transactions')
      .then(res => res.json())
      .then(data => setTransactions(Array.isArray(data) ? data : []))
      .catch(() => setTransactions([]));
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

      <a href="/add">
        <button style={{ marginTop: 20 }}>収支を追加する</button>
      </a>
    </div>
  );
}
