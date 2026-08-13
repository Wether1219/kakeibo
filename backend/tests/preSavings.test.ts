import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const TEST_HOUSEHOLD_ID = 999989n;
const OTHER_HOUSEHOLD_ID = 999988n;
const USER_ID = 999987n;
const OTHER_USER_ID = 999986n;
const app = createApp();

let preSavingCategoryId: string;
let incomeCategoryId: string;
const currentYear = new Date().getFullYear();

async function resetHousehold(id: bigint) {
  await prisma.preSaving.deleteMany({ where: { householdId: id } });
  await prisma.category.deleteMany({ where: { householdId: id } });
  await prisma.user.deleteMany({ where: { householdId: id } });
  await prisma.household.deleteMany({ where: { id } });
  await prisma.household.create({ data: { id } });
}

beforeAll(async () => {
  await resetHousehold(TEST_HOUSEHOLD_ID);
  await resetHousehold(OTHER_HOUSEHOLD_ID);
  await prisma.user.deleteMany({ where: { id: { in: [USER_ID, OTHER_USER_ID] } } });
  await prisma.user.createMany({
    data: [
      { id: USER_ID, householdId: TEST_HOUSEHOLD_ID, displayName: 'たいよう' },
      { id: OTHER_USER_ID, householdId: OTHER_HOUSEHOLD_ID, displayName: 'みらの' },
    ],
  });
  const preSavingCategory = await prisma.category.create({
    data: { householdId: TEST_HOUSEHOLD_ID, type: 'pre_saving', name: '積立投資' },
  });
  preSavingCategoryId = preSavingCategory.id.toString();
  const incomeCategory = await prisma.category.create({
    data: { householdId: TEST_HOUSEHOLD_ID, type: 'income', name: '給与' },
  });
  incomeCategoryId = incomeCategory.id.toString();
});

beforeEach(async () => {
  await prisma.preSaving.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.preSaving.deleteMany({ where: { householdId: OTHER_HOUSEHOLD_ID } });
});

afterAll(async () => {
  await prisma.preSaving.deleteMany({
    where: { householdId: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } },
  });
  await prisma.category.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.user.deleteMany({ where: { id: { in: [USER_ID, OTHER_USER_ID] } } });
  await prisma.household.deleteMany({ where: { id: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } } });
  await prisma.$disconnect();
});

function baseItem(overrides: Record<string, unknown> = {}) {
  return {
    year: currentYear,
    month: 5,
    userId: USER_ID.toString(),
    categoryId: preSavingCategoryId,
    budgetAmount: 50000,
    actualAmount: 50000,
    ...overrides,
  };
}

describe('/api/v1/pre-savings', () => {
  it('x-household-idヘッダーがない場合は401', async () => {
    const res = await request(app).get('/api/v1/pre-savings');
    expect(res.status).toBe(401);
  });

  it('一括登録して一覧取得できる', async () => {
    const putRes = await request(app)
      .put('/api/v1/pre-savings/bulk')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .send([baseItem()]);
    expect(putRes.status).toBe(200);
    expect(putRes.body).toHaveLength(1);
    expect(putRes.body[0]).toMatchObject({
      year: currentYear,
      month: 5,
      userId: USER_ID.toString(),
      categoryId: preSavingCategoryId,
      budgetAmount: 50000,
      actualAmount: 50000,
    });

    const listRes = await request(app)
      .get(`/api/v1/pre-savings?year=${currentYear}&month=5`)
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
  });

  it('budgetAmountは省略可（0扱い、現行I列相当の任意項目）', async () => {
    const putRes = await request(app)
      .put('/api/v1/pre-savings/bulk')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .send([{ year: currentYear, month: 5, userId: USER_ID.toString(), categoryId: preSavingCategoryId, actualAmount: 30000 }]);
    expect(putRes.status).toBe(200);
    expect(putRes.body[0].budgetAmount).toBe(0);
    expect(putRes.body[0].actualAmount).toBe(30000);
  });

  it('同一年月・人・費目で再送すると更新される（新規作成されない）', async () => {
    await request(app)
      .put('/api/v1/pre-savings/bulk')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .send([baseItem({ actualAmount: 10000 })]);
    const putRes = await request(app)
      .put('/api/v1/pre-savings/bulk')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .send([baseItem({ actualAmount: 40000 })]);
    expect(putRes.body).toHaveLength(1);
    expect(putRes.body[0].actualAmount).toBe(40000);

    const listRes = await request(app)
      .get('/api/v1/pre-savings')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    expect(listRes.body).toHaveLength(1);
  });

  it('type=pre_saving以外の費目は400', async () => {
    const res = await request(app)
      .put('/api/v1/pre-savings/bulk')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .send([baseItem({ categoryId: incomeCategoryId })]);
    expect(res.status).toBe(400);
  });

  it('monthが範囲外は400', async () => {
    const res = await request(app)
      .put('/api/v1/pre-savings/bulk')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .send([baseItem({ month: 0 })]);
    expect(res.status).toBe(400);
  });

  it('他世帯のデータは一覧に表示されない', async () => {
    const otherCategory = await prisma.category.create({
      data: { householdId: OTHER_HOUSEHOLD_ID, type: 'pre_saving', name: '積立NISA' },
    });
    await request(app)
      .put('/api/v1/pre-savings/bulk')
      .set('x-household-id', OTHER_HOUSEHOLD_ID.toString())
      .send([baseItem({ userId: OTHER_USER_ID.toString(), categoryId: otherCategory.id.toString() })]);

    const listRes = await request(app)
      .get('/api/v1/pre-savings')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    expect(listRes.body).toHaveLength(0);

    await prisma.preSaving.deleteMany({ where: { householdId: OTHER_HOUSEHOLD_ID } });
    await prisma.category.deleteMany({ where: { householdId: OTHER_HOUSEHOLD_ID } });
  });
});
