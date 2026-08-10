"use client";

import { useEffect, useState } from 'react';

export default function AddPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [form, setForm] = useState({
    user_id: 1,
    date: '',
    type: 'expense',
    category: '',
    amount: 0,
    memo: ''
  });

  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const submit = async () => {
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });

    alert('登録しました');
    window.location.href = '/';
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>収支を追加</h1>

      <input
        type="date"
        value={form.date}
        onChange={(e) => setForm({ ...form, date: e.target.value })}
      />

      <select
        value={form.type}
        onChange={(e) => setForm({ ...form, type: e.target.value })}
      >
        <option value="income">収入</option>
        <option value="expense">支出</option>
      </select>

      <select
        value={form.category}
        onChange={(e) => setForm({ ...form, category: e.target.value })}
      >
        <option value="">カテゴリを選択</option>
        {categories.map((c) => (
          <option key={c.id} value={c.name}>{c.name}</option>
        ))}
      </select>

      <input
        type="number"
        placeholder="金額"
        value={form.amount}
        onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
      />

      <textarea
        placeholder="メモ"
        value={form.memo}
        onChange={(e) => setForm({ ...form, memo: e.target.value })}
      />

      <div style={{ marginTop: 12 }}>
        <button onClick={submit}>登録</button>
      </div>
    </div>
  );
}
