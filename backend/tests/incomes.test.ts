import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';
import { authHeader } from './helpers/auth';

const TEST_HOUSEHOLD_ID = 999993n;
const OTHER_HOUSEHOLD_ID = 999992n;
const USER_ID = 999991n;
const OTHER_USER_ID = 999990n;
const app = createApp();

let incomeCategoryId: string;
let expenseCategoryId: string;
const currentYear = new Date().getFullYear();

async function resetHousehold(id: bigint) {
  await prisma.auditLog.deleteMany({ where: { householdId: id } });
  await prisma.income.deleteMany({ where: { householdId: id } });
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
      { id: USER_ID, householdId: TEST_HOUSEHOLD_ID, displayName: 'たいよう', email: `user${USER_ID}@test.local`, passwordHash: 'test-hash' },
      { id: OTHER_USER_ID, householdId: OTHER_HOUSEHOLD_ID, displayName: 'みらの', email: `user${OTHER_USER_ID}@test.local`, passwordHash: 'test-hash' },
    ],
  });
  const incomeCategory = await prisma.category.create({
    data: { householdId: TEST_HOUSEHOLD_ID, type: 'income', name: '給与' },
  });
  incomeCategoryId = incomeCategory.id.toString();
  const expenseCategory = await prisma.category.create({
    data: { householdId: TEST_HOUSEHOLD_ID, type: 'variable_expense', name: '食費' },
  });
  expenseCategoryId = expenseCategory.id.toString();
});

beforeEach(async () => {
  await prisma.income.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.income.deleteMany({ where: { householdId: OTHER_HOUSEHOLD_ID } });
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { householdId: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } } });
  await prisma.income.deleteMany({
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
    categoryId: incomeCategoryId,
    amount: 300000,
    ...overrides,
  };
}

describe('/api/v1/incomes', () => {
  it('Authorizationヘッダーがない場合は401', async () => {
    const res = await request(app).get('/api/v1/incomes');
    expect(res.status).toBe(401);
  });

  it('一括登録して一覧取得できる', async () => {
    const putRes = await request(app)
      .put('/api/v1/incomes/bulk')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send([baseItem()]);
    expect(putRes.status).toBe(200);
    expect(putRes.body).toHaveLength(1);
    expect(putRes.body[0]).toMatchObject({
      year: currentYear,
      month: 5,
      userId: USER_ID.toString(),
      categoryId: incomeCategoryId,
      amount: 300000,
    });

    const listRes = await request(app)
      .get(`/api/v1/incomes?year=${currentYear}&month=5`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].amount).toBe(300000);
  });

  it('同一年月・人・費目で再送すると更新される（新規作成されない）', async () => {
    await request(app)
      .put('/api/v1/incomes/bulk')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send([baseItem({ amount: 100000 })]);
    const putRes = await request(app)
      .put('/api/v1/incomes/bulk')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send([baseItem({ amount: 250000 })]);
    expect(putRes.status).toBe(200);
    expect(putRes.body).toHaveLength(1);
    expect(putRes.body[0].amount).toBe(250000);

    const listRes = await request(app)
      .get('/api/v1/incomes')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(listRes.body).toHaveLength(1);
  });

  it('type=income以外の費目は400', async () => {
    const res = await request(app)
      .put('/api/v1/incomes/bulk')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send([baseItem({ categoryId: expenseCategoryId })]);
    expect(res.status).toBe(400);
  });

  it('monthが範囲外は400', async () => {
    const res = await request(app)
      .put('/api/v1/incomes/bulk')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send([baseItem({ month: 13 })]);
    expect(res.status).toBe(400);
  });

  it('他世帯の費目IDを指定すると400', async () => {
    const otherCategory = await prisma.category.create({
      data: { householdId: OTHER_HOUSEHOLD_ID, type: 'income', name: '賞与' },
    });
    const res = await request(app)
      .put('/api/v1/incomes/bulk')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send([baseItem({ categoryId: otherCategory.id.toString() })]);
    expect(res.status).toBe(400);
    await prisma.category.delete({ where: { id: otherCategory.id } });
  });

  it('他世帯のデータは一覧に表示されない', async () => {
    await request(app)
      .put('/api/v1/incomes/bulk')
      .set('Authorization', authHeader(OTHER_HOUSEHOLD_ID, OTHER_USER_ID))
      .send([
        baseItem({
          userId: OTHER_USER_ID.toString(),
          categoryId: (
            await prisma.category.create({
              data: { householdId: OTHER_HOUSEHOLD_ID, type: 'income', name: '給与' },
            })
          ).id.toString(),
        }),
      ]);

    const listRes = await request(app)
      .get('/api/v1/incomes')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(listRes.body).toHaveLength(0);

    await prisma.income.deleteMany({ where: { householdId: OTHER_HOUSEHOLD_ID } });
    await prisma.category.deleteMany({ where: { householdId: OTHER_HOUSEHOLD_ID } });
  });
});
