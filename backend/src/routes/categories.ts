import { Router } from 'express';
import { CategoryType } from '@prisma/client';
import { HouseholdRequest, householdMiddleware } from '../middlewares/household';
import {
  CategoryNotFoundError,
  DuplicateCategoryError,
  createCategory,
  deactivateCategory,
  listCategories,
  updateCategory,
} from '../services/categoryService';

const CATEGORY_TYPES = Object.values(CategoryType);

function isCategoryType(value: unknown): value is CategoryType {
  return typeof value === 'string' && (CATEGORY_TYPES as string[]).includes(value);
}

function serializeCategory(category: {
  id: bigint;
  householdId: bigint;
  type: CategoryType;
  name: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: category.id.toString(),
    householdId: category.householdId.toString(),
    type: category.type,
    name: category.name,
    icon: category.icon,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    createdAt: category.createdAt.toISOString(),
  };
}

export const categoriesRouter = Router();
categoriesRouter.use(householdMiddleware);

categoriesRouter.get('/', async (req: HouseholdRequest, res) => {
  const typeParam = req.query.type;
  if (typeParam !== undefined && !isCategoryType(typeParam)) {
    res.status(400).json({ error: 'typeが不正です' });
    return;
  }
  const categories = await listCategories(req.householdId!, typeParam as CategoryType | undefined);
  res.json(categories.map(serializeCategory));
});

categoriesRouter.post('/', async (req: HouseholdRequest, res) => {
  const { type, name, icon } = req.body ?? {};
  if (!isCategoryType(type) || typeof name !== 'string' || name.trim() === '') {
    res.status(400).json({ error: 'type, nameは必須です' });
    return;
  }
  try {
    const category = await createCategory(req.householdId!, { type, name, icon });
    res.status(201).json(serializeCategory(category));
  } catch (e) {
    if (e instanceof DuplicateCategoryError) {
      res.status(409).json({ error: e.message });
      return;
    }
    throw e;
  }
});

categoriesRouter.put('/:id', async (req: HouseholdRequest, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    res.status(400).json({ error: 'idが不正です' });
    return;
  }
  const { name, icon, sortOrder } = req.body ?? {};
  if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
    res.status(400).json({ error: 'nameが不正です' });
    return;
  }
  if (sortOrder !== undefined && typeof sortOrder !== 'number') {
    res.status(400).json({ error: 'sortOrderが不正です' });
    return;
  }
  try {
    const category = await updateCategory(req.householdId!, BigInt(req.params.id), {
      name,
      icon,
      sortOrder,
    });
    res.json(serializeCategory(category));
  } catch (e) {
    if (e instanceof CategoryNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    if (e instanceof DuplicateCategoryError) {
      res.status(409).json({ error: e.message });
      return;
    }
    throw e;
  }
});

categoriesRouter.delete('/:id', async (req: HouseholdRequest, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    res.status(400).json({ error: 'idが不正です' });
    return;
  }
  try {
    await deactivateCategory(req.householdId!, BigInt(req.params.id));
    res.status(204).send();
  } catch (e) {
    if (e instanceof CategoryNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    throw e;
  }
});
