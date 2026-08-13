import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const TEST_HOUSEHOLD_ID = 999997n;
const OTHER_HOUSEHOLD_ID = 999996n;
const USER_ID = 999995n;
const OTHER_USER_ID = 999994n;
const app = createApp();

let categoryId: string;
const currentYear = new Date().getFullYear();

async function resetHousehold(id: bigint) {
  await prisma.auditLog.deleteMany({ where: { householdId: id } });
  await prisma.transaction.deleteMany({ where: { householdId: id } });
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
  const category = await prisma.category.create({
    data: { householdId: TEST_HOUSEHOLD_ID, type: 'variable_expense', name: '食費' },
  });
  categoryId = category.id.toString();
});

beforeEach(async () => {
  await prisma.transaction.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.transaction.deleteMany({ where: { householdId: OTHER_HOUSEHOLD_ID } });
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { householdId: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } } });
  await prisma.transaction.deleteMany({
    where: { householdId: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } },
  });
  await prisma.category.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.user.deleteMany({ where: { id: { in: [USER_ID, OTHER_USER_ID] } } });
  await prisma.household.deleteMany({ where: { id: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } } });
  await prisma.$disconnect();
});

function baseBody(overrides: Record<string, unknown> = {}) {
  return {
    transactionDate: `${currentYear}-05-10`,
    categoryId,
    splitType: 'self',
    userId: USER_ID.toString(),
    amount: 1000,
    memo: 'ランチ',
    ...overrides,
  };
}

describe('/api/v1/transactions', () => {
  it('x-household-idヘッダーがない場合は401', async () => {
    const res = await request(app).get('/api/v1/transactions');
    expect(res.status).toBe(401);
  });

  it('x-user-idヘッダーがない場合、登録は401', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .send(baseBody());
    expect(res.status).toBe(401);
  });

  it('取引を登録して一覧取得できる', async () => {
    const createRes = await request(app)
      .post('/api/v1/transactions')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_ID.toString())
      .send(baseBody());
    expect(createRes.status).toBe(201);
    expect(createRes.body).toMatchObject({
      categoryId,
      splitType: 'self',
      userId: USER_ID.toString(),
      amount: 1000,
      memo: 'ランチ',
      createdBy: USER_ID.toString(),
    });

    const listRes = await request(app)
      .get('/api/v1/transactions')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].amount).toBe(1000);
  });

  it('splitType=sharedの場合、userIdはNULLになる', async () => {
    const createRes = await request(app)
      .post('/api/v1/transactions')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_ID.toString())
      .send(baseBody({ splitType: 'shared', userId: USER_ID.toString() }));
    expect(createRes.status).toBe(201);
    expect(createRes.body.splitType).toBe('shared');
    expect(createRes.body.userId).toBeNull();
  });

  it('splitType=selfでuserId未指定は400', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_ID.toString())
      .send(baseBody({ splitType: 'self', userId: undefined }));
    expect(res.status).toBe(400);
  });

  it('金額が0以下は400', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_ID.toString())
      .send(baseBody({ amount: 0 }));
    expect(res.status).toBe(400);
  });

  it('当年内でない日付は400', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_ID.toString())
      .send(baseBody({ transactionDate: `${currentYear - 1}-05-10` }));
    expect(res.status).toBe(400);
  });

  it('year・monthで絞り込める', async () => {
    await request(app)
      .post('/api/v1/transactions')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_ID.toString())
      .send(baseBody({ transactionDate: `${currentYear}-05-10` }));
    await request(app)
      .post('/api/v1/transactions')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_ID.toString())
      .send(baseBody({ transactionDate: `${currentYear}-06-10` }));

    const res = await request(app)
      .get(`/api/v1/transactions?year=${currentYear}&month=5`)
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].transactionDate).toBe(`${currentYear}-05-10`);
  });

  it('取引を更新できる', async () => {
    const createRes = await request(app)
      .post('/api/v1/transactions')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_ID.toString())
      .send(baseBody());
    const id = createRes.body.id;

    const updateRes = await request(app)
      .put(`/api/v1/transactions/${id}`)
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_ID.toString())
      .send(baseBody({ amount: 2000, memo: '更新後' }));
    expect(updateRes.status).toBe(200);
    expect(updateRes.body).toMatchObject({ amount: 2000, memo: '更新後' });
  });

  it('他世帯の取引は更新・削除できない(404)', async () => {
    const otherCategory = await prisma.category.create({
      data: { householdId: OTHER_HOUSEHOLD_ID, type: 'variable_expense', name: '光熱費' },
    });
    const createRes = await request(app)
      .post('/api/v1/transactions')
      .set('x-household-id', OTHER_HOUSEHOLD_ID.toString())
      .set('x-user-id', OTHER_USER_ID.toString())
      .send(baseBody({ categoryId: otherCategory.id.toString() }));
    const id = createRes.body.id;

    const updateRes = await request(app)
      .put(`/api/v1/transactions/${id}`)
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_ID.toString())
      .send(baseBody());
    expect(updateRes.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/v1/transactions/${id}`)
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_ID.toString());
    expect(deleteRes.status).toBe(404);

    await prisma.transaction.deleteMany({ where: { householdId: OTHER_HOUSEHOLD_ID } });
    await prisma.category.delete({ where: { id: otherCategory.id } });
  });

  it('取引を削除できる', async () => {
    const createRes = await request(app)
      .post('/api/v1/transactions')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_ID.toString())
      .send(baseBody());
    const id = createRes.body.id;

    const deleteRes = await request(app)
      .delete(`/api/v1/transactions/${id}`)
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_ID.toString());
    expect(deleteRes.status).toBe(204);

    const listRes = await request(app)
      .get('/api/v1/transactions')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    expect(listRes.body).toHaveLength(0);
  });
});
