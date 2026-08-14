import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';
import { authHeader } from './helpers/auth';

const TEST_HOUSEHOLD_ID = 999899n;
const OTHER_HOUSEHOLD_ID = 999898n;
const USER_ID = 999897n;
const OTHER_USER_ID = 999896n;
const app = createApp();

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth() + 1;
const PAST_YEAR = CURRENT_YEAR - 1;

let variableCategoryId: string;
let incomeCategoryId: string;

async function resetHousehold(id: bigint) {
  await prisma.auditLog.deleteMany({ where: { householdId: id } });
  await prisma.transaction.deleteMany({ where: { householdId: id } });
  await prisma.recurringTransaction.deleteMany({ where: { householdId: id } });
  await prisma.category.deleteMany({ where: { householdId: id } });
  await prisma.user.deleteMany({ where: { householdId: id } });
  await prisma.household.deleteMany({ where: { id } });
  await prisma.household.create({ data: { id } });
}

beforeAll(async () => {
  await resetHousehold(TEST_HOUSEHOLD_ID);
  await resetHousehold(OTHER_HOUSEHOLD_ID);
  await prisma.user.createMany({
    data: [
      {
        id: USER_ID,
        householdId: TEST_HOUSEHOLD_ID,
        displayName: 'たいよう',
        email: `user${USER_ID}@test.local`,
        passwordHash: 'test-hash',
      },
      {
        id: OTHER_USER_ID,
        householdId: OTHER_HOUSEHOLD_ID,
        displayName: 'みらの',
        email: `user${OTHER_USER_ID}@test.local`,
        passwordHash: 'test-hash',
      },
    ],
  });
  const variableCategory = await prisma.category.create({
    data: { householdId: TEST_HOUSEHOLD_ID, type: 'variable_expense', name: 'サブスク' },
  });
  variableCategoryId = variableCategory.id.toString();
  const incomeCategory = await prisma.category.create({
    data: { householdId: TEST_HOUSEHOLD_ID, type: 'income', name: '給与' },
  });
  incomeCategoryId = incomeCategory.id.toString();
});

beforeEach(async () => {
  await prisma.transaction.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.recurringTransaction.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
});

afterAll(async () => {
  await resetHousehold(TEST_HOUSEHOLD_ID);
  await resetHousehold(OTHER_HOUSEHOLD_ID);
  await prisma.household.deleteMany({ where: { id: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } } });
  await prisma.$disconnect();
});

function baseBody(overrides: Record<string, unknown> = {}) {
  return {
    categoryId: variableCategoryId,
    splitType: 'self',
    userId: USER_ID.toString(),
    amount: 980,
    memo: '動画配信',
    dayOfMonth: 5,
    ...overrides,
  };
}

describe('/api/v1/recurring-transactions', () => {
  it('Authorizationヘッダーがない場合は401', async () => {
    const res = await request(app).get('/api/v1/recurring-transactions');
    expect(res.status).toBe(401);
  });

  it('定期取引を登録して一覧取得できる', async () => {
    const createRes = await request(app)
      .post('/api/v1/recurring-transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody());
    expect(createRes.status).toBe(201);
    expect(createRes.body).toMatchObject({
      categoryId: variableCategoryId,
      splitType: 'self',
      userId: USER_ID.toString(),
      amount: 980,
      dayOfMonth: 5,
      isActive: true,
    });

    const listRes = await request(app)
      .get('/api/v1/recurring-transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
  });

  it('splitType=selfでuserId未指定は400', async () => {
    const res = await request(app)
      .post('/api/v1/recurring-transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ userId: undefined }));
    expect(res.status).toBe(400);
  });

  it('固定費・変動費以外の費目（収入）は400', async () => {
    const res = await request(app)
      .post('/api/v1/recurring-transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ categoryId: incomeCategoryId }));
    expect(res.status).toBe(400);
  });

  it('dayOfMonthが範囲外（0または29）は400', async () => {
    const res1 = await request(app)
      .post('/api/v1/recurring-transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ dayOfMonth: 0 }));
    expect(res1.status).toBe(400);

    const res2 = await request(app)
      .post('/api/v1/recurring-transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ dayOfMonth: 29 }));
    expect(res2.status).toBe(400);
  });

  it('無効化（isActive: false）できる', async () => {
    const createRes = await request(app)
      .post('/api/v1/recurring-transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody());
    const id = createRes.body.id;

    const updateRes = await request(app)
      .put(`/api/v1/recurring-transactions/${id}`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send({ isActive: false });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.isActive).toBe(false);
  });

  it('他世帯の定期取引は更新できない(404)', async () => {
    const otherCategory = await prisma.category.create({
      data: { householdId: OTHER_HOUSEHOLD_ID, type: 'variable_expense', name: '光熱費' },
    });
    const createRes = await request(app)
      .post('/api/v1/recurring-transactions')
      .set('Authorization', authHeader(OTHER_HOUSEHOLD_ID, OTHER_USER_ID))
      .send(
        baseBody({ categoryId: otherCategory.id.toString(), userId: OTHER_USER_ID.toString() })
      );
    const id = createRes.body.id;

    const updateRes = await request(app)
      .put(`/api/v1/recurring-transactions/${id}`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send({ isActive: false });
    expect(updateRes.status).toBe(404);

    await prisma.recurringTransaction.deleteMany({ where: { householdId: OTHER_HOUSEHOLD_ID } });
    await prisma.category.delete({ where: { id: otherCategory.id } });
  });

  it('当月のダッシュボード表示で定期取引から取引が自動生成される（二重生成されない）', async () => {
    await request(app)
      .post('/api/v1/recurring-transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody());

    const res1 = await request(app)
      .get(`/api/v1/summary/monthly?year=${CURRENT_YEAR}&month=${CURRENT_MONTH}`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(res1.status).toBe(200);

    const transactionsRes1 = await request(app)
      .get(`/api/v1/transactions?year=${CURRENT_YEAR}&month=${CURRENT_MONTH}`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(transactionsRes1.body).toHaveLength(1);
    expect(transactionsRes1.body[0].amount).toBe(980);

    // 同じ月をもう一度表示しても重複生成されない
    await request(app)
      .get(`/api/v1/summary/monthly?year=${CURRENT_YEAR}&month=${CURRENT_MONTH}`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    const transactionsRes2 = await request(app)
      .get(`/api/v1/transactions?year=${CURRENT_YEAR}&month=${CURRENT_MONTH}`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(transactionsRes2.body).toHaveLength(1);
  });

  it('過去月を表示しても定期取引は生成されない', async () => {
    await request(app)
      .post('/api/v1/recurring-transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody());

    await request(app)
      .get(`/api/v1/summary/monthly?year=${PAST_YEAR}&month=1`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));

    const transactionsRes = await request(app)
      .get(`/api/v1/transactions?year=${PAST_YEAR}&month=1`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(transactionsRes.body).toHaveLength(0);
  });
});
