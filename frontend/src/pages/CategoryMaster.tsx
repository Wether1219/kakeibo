import { FormEvent, useState } from 'react';
import { useCategories } from '../hooks/useCategories';
import { CategoryTypeSection } from '../components/CategoryTypeSection';
import { IconPicker } from '../components/IconPicker';
import type { Category, CategoryType } from '../api/categories';
import { ErrorMessage, LoadingMessage } from '../components/StatusMessage';

const TYPE_LABELS: Record<CategoryType, string> = {
  income: '収入',
  pre_saving: '先取り貯金・投資',
  fixed_expense: '固定費',
  variable_expense: '変動費',
};

const TYPE_ORDER: CategoryType[] = ['income', 'pre_saving', 'fixed_expense', 'variable_expense'];

export function CategoryMaster() {
  const { categories, loading, error, add, rename, changeIcon, deactivate, reactivate, reorder } =
    useCategories();
  const [newType, setNewType] = useState<CategoryType>('variable_expense');
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

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

  const byType = (type: CategoryType) =>
    categories.filter((c) => c.type === type && c.isActive === !showInactive);

  const handleReorder = (type: CategoryType) => async (reordered: Category[]) => {
    const others = categories.filter((c) => c.type !== type);
    await reorder([...others, ...reordered]);
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">費目マスタ管理</h1>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          無効化済みを表示
        </label>
      </div>

      <form onSubmit={handleAdd} className="flex flex-wrap gap-2 mb-6 items-end">
        <div>
          <label htmlFor="category-master-type" className="block text-xs text-gray-500 dark:text-gray-400">区分</label>
          <select
            id="category-master-type"
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
          <label htmlFor="category-master-name" className="block text-xs text-gray-500 dark:text-gray-400">費目名</label>
          <input
            id="category-master-name"
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
      {formError && <ErrorMessage className="mb-4">{formError}</ErrorMessage>}

      {loading && <LoadingMessage />}
      {error && <ErrorMessage>{error}</ErrorMessage>}

      {!loading &&
        !error &&
        !showInactive &&
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

      {!loading &&
        !error &&
        showInactive &&
        TYPE_ORDER.map((type) => (
          <InactiveCategoryList
            key={type}
            title={TYPE_LABELS[type]}
            categories={byType(type)}
            onReactivate={reactivate}
          />
        ))}
    </div>
  );
}

function InactiveCategoryList({
  title,
  categories,
  onReactivate,
}: {
  title: string;
  categories: Category[];
  onReactivate: (category: Category) => Promise<void>;
}) {
  return (
    <section className="mb-6">
      <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2">{title}</h2>
      <ul className="rounded border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
        {categories.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500"
          >
            <span aria-hidden>{c.icon}</span>
            <span className="flex-1">{c.name}</span>
            <button
              type="button"
              className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-2"
              onClick={() => onReactivate(c)}
            >
              再有効化
            </button>
          </li>
        ))}
        {categories.length === 0 && (
          <li className="px-3 py-4 text-sm text-gray-400 dark:text-gray-500">無効化済みの費目はありません</li>
        )}
      </ul>
    </section>
  );
}
