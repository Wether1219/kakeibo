import { useCallback, useEffect, useState } from 'react';
import * as api from '../api/categories';
import type { Category, CategoryType } from '../api/categories';

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.fetchCategories();
      setCategories(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const add = useCallback(
    async (type: CategoryType, name: string, icon: string) => {
      await api.createCategory({ type, name, icon: icon || undefined });
      await reload();
    },
    [reload]
  );

  const rename = useCallback(
    async (id: string, name: string) => {
      await api.updateCategory(id, { name });
      await reload();
    },
    [reload]
  );

  const changeIcon = useCallback(
    async (id: string, icon: string) => {
      await api.updateCategory(id, { icon });
      await reload();
    },
    [reload]
  );

  const deactivate = useCallback(
    async (id: string) => {
      await api.deactivateCategory(id);
      await reload();
    },
    [reload]
  );

  const reactivate = useCallback(
    async (category: Category) => {
      // 無効化済みと同じ区分・名前で追加すると、バックエンド側が再有効化として扱う
      await api.createCategory({ type: category.type, name: category.name, icon: category.icon ?? undefined });
      await reload();
    },
    [reload]
  );

  const reorder = useCallback(async (reordered: Category[]) => {
    setCategories(reordered);
    await Promise.all(
      reordered.map((c, index) => api.updateCategory(c.id, { sortOrder: index }))
    );
  }, []);

  return { categories, loading, error, add, rename, changeIcon, deactivate, reactivate, reorder };
}
