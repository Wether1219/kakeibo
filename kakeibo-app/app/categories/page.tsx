"use client";

import { useEffect, useState } from 'react';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [name, setName] = useState('');

  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(setCategories);
  }, []);

  const addCategory = async () => {
    if (!name.trim()) return;

    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 1, name: name.trim() })
    });

    setName('');
    setCategories(await fetch('/api/categories').then(res => res.json()));
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>カテゴリ管理</h1>

      <div style={{ marginBottom: 16 }}>
        <input
          placeholder="カテゴリ名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <button onClick={addCategory}>追加</button>
      </div>

      <ul>
        {categories.map((c) => (
          <li key={c.id}>{c.name}</li>
        ))}
      </ul>
    </div>
  );
}
