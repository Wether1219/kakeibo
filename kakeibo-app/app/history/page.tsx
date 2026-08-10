"use client";

import { useEffect, useState } from 'react';

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/transactions')
      .then(res => res.json())
      .then(data => setTransactions(Array.isArray(data) ? data : []))
      .catch(() => setTransactions([]));
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>履歴一覧</h1>

      <ul>
        {transactions.map((t: any) => (
          <li key={t.id}>
            {t.created_at ?? t.date} / {t.category} / {t.type} / {t.amount}円
          </li>
        ))}
      </ul>
    </div>
  );
}
