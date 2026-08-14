import { FormEvent, useState } from 'react';
import { useCategories } from '../hooks/useCategories';
import { CategoryTypeSection } from '../components/CategoryTypeSection';
import { IconPicker } from '../components/IconPicker';
import type { Category, CategoryType } from '../api/categories';

const TYPE_LABELS: Record<CategoryType, string> = {
  income: '収入',
  pre_saving: '先取り貯金・投資',
  fixed_expense: '固定費',
  variable_expense: '変動費',
};

const TYPE_ORDER: CategoryType[] = ['income', 'pre_saving', 'fixed_expense', 'variable_expense'];

export function CategoryMaster() {
  const { categories, loading, error, add, rename, changeIcon, deactivate, reorder } =
    useCategories();
  const [newType, setNewType] = useState<CategoryType>('variable_expense');
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!newName.trim()) return;
    try {
      await add(newType, newName.trim(), newIcon.trim());
      setNewName('');
      setNewIcon('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    }
  };

  const byType = (type: CategoryType) => categories.filter((c) => c.type === type);

  const handleReorder = (type: CategoryType) => async (reordered: Category[]) => {
    const others = categories.filter((c) => c.type !== type);
    await reorder([...others, ...reordered]);
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">費目マスタ管理</h1>

      <form onSubmit={handleAdd} className="flex flex-wrap gap-2 mb-6 items-end">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400">区分</label>
          <select
            className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1"
            value={newType}
            onChange={(e) => setNewType(e.target.value as CategoryType)}
          >
            {TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400">アイコン</label>
          <IconPicker value={newIcon} onChange={setNewIcon} />
        </div>
        <div className="flex-1 min-w-[8rem]">
          <label className="block text-xs text-gray-500 dark:text-gray-400">費目名</label>
          <input
            className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="例：食費"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white rounded px-4 py-1.5 hover:bg-blue-700"
        >
          追加
        </button>
      </form>
      {formError && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{formError}</p>}

      {loading && <p className="text-sm text-gray-400 dark:text-gray-500">読み込み中...</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!loading &&
        !error &&
        TYPE_ORDER.map((type) => (
          <CategoryTypeSection
            key={type}
            title={TYPE_LABELS[type]}
            categories={byType(type)}
            onRename={rename}
            onChangeIcon={changeIcon}
            onDeactivate={deactivate}
            onReorder={handleReorder(type)}
          />
        ))}
    </div>
  );
}
