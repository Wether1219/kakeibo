import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';
import { authHeader } from './helpers/auth';

const TEST_HOUSEHOLD_ID = 999879n;
const OTHER_HOUSEHOLD_ID = 999878n;
const USER_A = 999877n; // たいよう
const USER_B = 999876n; // みらの
const OTHER_USER_ID = 999875n;
const app = createApp();

const currentYear = new Date().getFullYear();

let categoryId: string;

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
  await prisma.user.deleteMany({ where: { id: { in: [USER_A, USER_B, OTHER_USER_ID] } } });
  await prisma.user.createMany({
    data: [
      { id: USER_A, householdId: TEST_HOUSEHOLD_ID, displayName: 'たいよう', email: `user${USER_A}@test.local`, passwordHash: 'test-hash' },
      { id: USER_B, householdId: TEST_HOUSEHOLD_ID, displayName: 'みらの', email: `user${USER_B}@test.local`, passwordHash: 'test-hash' },
      { id: OTHER_USER_ID, householdId: OTHER_HOUSEHOLD_ID, displayName: '他世帯', email: `user${OTHER_USER_ID}@test.local`, passwordHash: 'test-hash' },
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
  await prisma.user.deleteMany({ where: { id: { in: [USER_A, USER_B, OTHER_USER_ID] } } });
  await prisma.household.deleteMany({ where: { id: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } } });
  await prisma.$disconnect();
});

async function createTx(
  createdBy: bigint,
  overrides: Record<string, unknown> = {}
) {
  await request(app)
    .post('/api/v1/transactions')
    .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, createdBy))
    .send({
      transactionDate: `${currentYear}-05-10`,
      categoryId,
      splitType: 'shared',
      amount: 1000,
      ...overrides,
    });
}

describe('GET /api/v1/summary/settlement', () => {
  it('Authorizationヘッダーがない場合は401', async () => {
    const res = await request(app).get('/api/v1/summary/settlement?startDate=2026-05-01&endDate=2026-05-31');
    expect(res.status).toBe(401);
  });

  it('日付形式が不正な場合は400', async () => {
    const res = await request(app)
      .get('/api/v1/summary/settlement?startDate=2026/05/01&endDate=2026-05-31')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A));
    expect(res.status).toBe(400);
  });

  it('startDateがendDateより後の場合は400', async () => {
    const res = await request(app)
      .get('/api/v1/summary/settlement?startDate=2026-06-01&endDate=2026-05-01')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A));
    expect(res.status).toBe(400);
  });

  it('世帯のユーザーが2人でない場合は400', async () => {
    const res = await request(app)
      .get(`/api/v1/summary/settlement?startDate=${currentYear}-05-01&endDate=${currentYear}-05-31`)
      .set('Authorization', authHeader(OTHER_HOUSEHOLD_ID, OTHER_USER_ID));
    expect(res.status).toBe(400);
  });

  it('①②③④混在ケースで正しいnetAmount・方向・内訳が返る', async () => {
    // ①たいようがshared 4000円（うちみらのが現地で2000円直接支払い）
    await createTx(USER_A, { splitType: 'shared', amount: 4000, otherPaidAmount: 2000 });
    // ②みらのがshared 1000円
    await createTx(USER_B, { splitType: 'shared', amount: 1000 });
    // ③たいようがみらの個人のために3000円支払い
    await createTx(USER_A, { splitType: 'self', userId: USER_B.toString(), amount: 3000 });
    // ④みらのがたいよう個人のために500円支払い
    await createTx(USER_B, { splitType: 'self', userId: USER_A.toString(), amount: 500 });

    const res = await request(app)
      .get(`/api/v1/summary/settlement?startDate=${currentYear}-05-01&endDate=${currentYear}-05-31`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A));
    expect(res.status).toBe(200);
    // due(①)=4000/2-2000=0, due(②)=500, due(③)=3000, due(④)=500
    // ((①due)+③)-((②due)+④) = (0+3000)-(500+500) = 2000 → みらの→たいよう
    expect(res.body.netAmount).toBe(2000);
    expect(res.body.fromDisplayName).toBe('みらの');
    expect(res.body.toDisplayName).toBe('たいよう');

    const taiyoRow = res.body.breakdown.find((r: { displayName: string }) => r.displayName === 'たいよう');
    expect(taiyoRow).toMatchObject({
      sharedPaidTotal: 4000,
      sharedOtherPaidTotal: 2000,
      paidForOtherTotal: 3000,
      paidForOtherOtherPaidTotal: 0,
    });
    const miranoRow = res.body.breakdown.find((r: { displayName: string }) => r.displayName === 'みらの');
    expect(miranoRow).toMatchObject({
      sharedPaidTotal: 1000,
      sharedOtherPaidTotal: 0,
      paidForOtherTotal: 500,
      paidForOtherOtherPaidTotal: 0,
    });
  });

  it('精算不要（0円）の場合はfrom/toがnullになる', async () => {
    await createTx(USER_A, { splitType: 'shared', amount: 1000 });
    await createTx(USER_B, { splitType: 'shared', amount: 1000 });

    const res = await request(app)
      .get(`/api/v1/summary/settlement?startDate=${currentYear}-05-01&endDate=${currentYear}-05-31`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A));
    expect(res.status).toBe(200);
    expect(res.body.netAmount).toBe(0);
    expect(res.body.fromUserId).toBeNull();
    expect(res.body.toUserId).toBeNull();
  });

  it('期間の境界値：startDate・endDate当日は含み、前後日は除外される', async () => {
    await createTx(USER_A, { splitType: 'shared', amount: 2000, transactionDate: `${currentYear}-05-01` });
    await createTx(USER_A, { splitType: 'shared', amount: 2000, transactionDate: `${currentYear}-05-31` });
    await createTx(USER_A, { splitType: 'shared', amount: 2000, transactionDate: `${currentYear}-04-30` });
    await createTx(USER_A, { splitType: 'shared', amount: 2000, transactionDate: `${currentYear}-06-01` });

    const res = await request(app)
      .get(`/api/v1/summary/settlement?startDate=${currentYear}-05-01&endDate=${currentYear}-05-31`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A));
    expect(res.status).toBe(200);
    // 期間内2件(4000円)の半額=2000円のみがnetAmountになる
    expect(res.body.netAmount).toBe(2000);
  });

  it('他世帯データが混入しない', async () => {
    await createTx(USER_A, { splitType: 'shared', amount: 1000 });
    const otherCategory = await prisma.category.create({
      data: { householdId: OTHER_HOUSEHOLD_ID, type: 'variable_expense', name: '光熱費' },
    });
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(OTHER_HOUSEHOLD_ID, OTHER_USER_ID))
      .send({
        transactionDate: `${currentYear}-05-10`,
        categoryId: otherCategory.id.toString(),
        splitType: 'shared',
        amount: 999999,
      });

    const res = await request(app)
      .get(`/api/v1/summary/settlement?startDate=${currentYear}-05-01&endDate=${currentYear}-05-31`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A));
    expect(res.status).toBe(200);
    expect(res.body.netAmount).toBe(500);

    await prisma.transaction.deleteMany({ where: { householdId: OTHER_HOUSEHOLD_ID } });
    await prisma.category.delete({ where: { id: otherCategory.id } });
  });
});
