import { CategoryType, Prisma } from '@prisma/client';
import { prisma } from '../prisma';

export class DuplicateCategoryError extends Error {}
export class CategoryNotFoundError extends Error {}

export async function listCategories(householdId: bigint, type?: CategoryType) {
  return prisma.category.findMany({
    where: { householdId, ...(type ? { type } : {}) },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function createCategory(
  householdId: bigint,
  data: { type: CategoryType; name: string; icon?: string | null }
) {
  try {
    return await prisma.category.create({
      data: {
        householdId,
        type: data.type,
        name: data.name,
        icon: data.icon ?? null,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new DuplicateCategoryError('同じ区分・名前の費目が既に存在します');
    }
    throw e;
  }
}

export async function updateCategory(
  householdId: bigint,
  id: bigint,
  data: { name?: string; icon?: string | null; sortOrder?: number }
) {
  const existing = await prisma.category.findFirst({ where: { id, householdId } });
  if (!existing) {
    throw new CategoryNotFoundError('費目が見つかりません');
  }
  try {
    const after = await prisma.category.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.icon !== undefined ? { icon: data.icon } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      },
    });
    return { before: existing, after };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new DuplicateCategoryError('同じ区分・名前の費目が既に存在します');
    }
    throw e;
  }
}

export async function deactivateCategory(householdId: bigint, id: bigint) {
  const existing = await prisma.category.findFirst({ where: { id, householdId } });
  if (!existing) {
    throw new CategoryNotFoundError('費目が見つかりません');
  }
  const after = await prisma.category.update({ where: { id }, data: { isActive: false } });
  return { before: existing, after };
}
