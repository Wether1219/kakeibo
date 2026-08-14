import { useState } from 'react';
import { IconPicker } from './IconPicker';
import type { Category } from '../api/categories';

interface Props {
  title: string;
  categories: Category[];
  onRename: (id: string, name: string) => Promise<void>;
  onChangeIcon: (id: string, icon: string) => Promise<void>;
  onDeactivate: (id: string) => Promise<void>;
  onReorder: (reordered: Category[]) => Promise<void>;
}

export function CategoryTypeSection({
  title,
  categories,
  onRename,
  onChangeIcon,
  onDeactivate,
  onReorder,
}: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleDrop = (dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex) return;
    const reordered = [...categories];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    setDragIndex(null);
    onReorder(reordered);
  };

  const startEdit = (c: Category) => {
    setEditingId(c.id);
    setEditingName(c.name);
  };

  const commitEdit = async (id: string) => {
    const name = editingName.trim();
    setEditingId(null);
    if (name) {
      await onRename(id, name);
    }
  };

  return (
    <section className="mb-6">
      <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2">{title}</h2>
      <ul className="rounded border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
        {categories.map((c, index) => (
          <li
            key={c.id}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(index)}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 cursor-move"
          >
            <span className="text-gray-300 dark:text-gray-600" aria-hidden>
              ⠿
            </span>
            <IconPicker value={c.icon ?? ''} onChange={(icon) => onChangeIcon(c.id, icon)} />
            {editingId === c.id ? (
              <input
                autoFocus
                className="flex-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => commitEdit(c.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit(c.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
              />
            ) : (
              <button
                type="button"
                className="flex-1 text-left px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                onClick={() => startEdit(c)}
              >
                {c.name}
              </button>
            )}
            <button
              type="button"
              className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 px-2"
              onClick={() => onDeactivate(c.id)}
            >
              無効化
            </button>
          </li>
        ))}
        {categories.length === 0 && (
          <li className="px-3 py-4 text-sm text-gray-400 dark:text-gray-500">費目がありません</li>
        )}
      </ul>
    </section>
  );
}
