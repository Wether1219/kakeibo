import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';
import { authHeader } from './helpers/auth';

const TEST_HOUSEHOLD_ID = 999879n;
const OTHER_HOUSEHOLD_ID = 999878n;
const USER_A = 999876n; // たいよう（id昇順で先頭）
const USER_B = 999877n; // みらの
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

async function createTx(createdBy: bigint, overrides: Record<string, unknown> = {}) {
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
    const res = await request(app).get(`/api/v1/summary/settlement?year=${currentYear}&month=5`);
    expect(res.status).toBe(401);
  });

  it('year・monthが不正な場合は400', async () => {
    const res = await request(app)
      .get('/api/v1/summary/settlement?year=abc&month=5')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A));
    expect(res.status).toBe(400);
  });

  it('世帯のユーザーが2人でない場合は400', async () => {
    const res = await request(app)
      .get(`/api/v1/summary/settlement?year=${currentYear}&month=5`)
      .set('Authorization', authHeader(OTHER_HOUSEHOLD_ID, OTHER_USER_ID));
    expect(res.status).toBe(400);
  });

  it('精算対象取引がない場合はNONEでfrom/toがnullになる', async () => {
    await createTx(USER_A);

    const res = await request(app)
      .get(`/api/v1/summary/settlement?year=${currentYear}&month=5`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A));
    expect(res.status).toBe(200);
    expect(res.body.direction).toBe('NONE');
    expect(res.body.fromUser).toBeNull();
    expect(res.body.toUser).toBeNull();
    expect(res.body.amount).toBe(0);
  });

  it('折半（half）の精算金額・方向が正しく計算される', async () => {
    // たいようが立て替えて折半（負担額2000円）、みらのが2000円払うべき
    await createTx(USER_A, { settlementPayerUserId: USER_A.toString(), settlementBurden: 'half', amount: 4000 });

    const res = await request(app)
      .get(`/api/v1/summary/settlement?year=${currentYear}&month=5`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A));
    expect(res.status).toBe(200);
    expect(res.body.direction).toBe('B_TO_A');
    expect(res.body.amount).toBe(2000);
    expect(res.body.fromUser.displayName).toBe('みらの');
    expect(res.body.toUser.displayName).toBe('たいよう');
    expect(res.body.transactionCount).toBe(1);
  });

  it('相手がその場で払った額（settlementPartialAmount）が差し引かれる', async () => {
    await createTx(USER_A, {
      settlementPayerUserId: USER_A.toString(),
      settlementBurden: 'half',
      amount: 4000,
      settlementPartialAmount: 2000,
    });

    const res = await request(app)
      .get(`/api/v1/summary/settlement?year=${currentYear}&month=5`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A));
    expect(res.status).toBe(200);
    // 負担額2000円のうち既に2000円払ってもらっているので精算不要
    expect(res.body.direction).toBe('NONE');
  });

  it('全額相手負担（other_full）は立替額全額が精算対象になる', async () => {
    await createTx(USER_B, { settlementPayerUserId: USER_B.toString(), settlementBurden: 'other_full', amount: 3000 });

    const res = await request(app)
      .get(`/api/v1/summary/settlement?year=${currentYear}&month=5`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A));
    expect(res.status).toBe(200);
    expect(res.body.direction).toBe('A_TO_B');
    expect(res.body.amount).toBe(3000);
    expect(res.body.fromUser.displayName).toBe('たいよう');
    expect(res.body.toUser.displayName).toBe('みらの');
  });

  it('対象月以外の取引は集計に含まれない', async () => {
    await createTx(USER_A, {
      settlementPayerUserId: USER_A.toString(),
      settlementBurden: 'half',
      amount: 4000,
      transactionDate: `${currentYear}-04-30`,
    });
    await createTx(USER_A, {
      settlementPayerUserId: USER_A.toString(),
      settlementBurden: 'half',
      amount: 4000,
      transactionDate: `${currentYear}-06-01`,
    });

    const res = await request(app)
      .get(`/api/v1/summary/settlement?year=${currentYear}&month=5`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A));
    expect(res.status).toBe(200);
    expect(res.body.direction).toBe('NONE');
    expect(res.body.transactionCount).toBe(0);
  });

  it('他世帯データが混入しない', async () => {
    await createTx(USER_A, { settlementPayerUserId: USER_A.toString(), settlementBurden: 'half', amount: 2000 });
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
      .get(`/api/v1/summary/settlement?year=${currentYear}&month=5`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A));
    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(1000);

    await prisma.transaction.deleteMany({ where: { householdId: OTHER_HOUSEHOLD_ID } });
    await prisma.category.delete({ where: { id: otherCategory.id } });
  });
});
