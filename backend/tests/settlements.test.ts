// docs/08_割り勘計算 仕様書.md 4章「API仕様」のGET /api/v1/settlementsの結合テスト。
// 計算そのものはtests/settlementService.test.tsで検証済みのため、ここではAPIとしての
// バリデーション・household分離・レスポンス形式（4章のJSON）に絞って確認する。
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';
import { authHeader } from './helpers/auth';

const TEST_HOUSEHOLD_ID = 999939n;
const OTHER_HOUSEHOLD_ID = 999938n;
const USER_A = 999936n; // たいよう（user_id昇順の先頭）
const USER_B = 999937n; // みらの
const app = createApp();

const YEAR = 2027;
const MONTH = 1;

let categoryId: bigint;

async function resetHousehold(id: bigint) {
  await prisma.auditLog.deleteMany({ where: { householdId: id } });
  await prisma.transaction.deleteMany({ where: { householdId: id } });
  await prisma.category.deleteMany({ where: { householdId: id } });
  await prisma.user.deleteMany({ where: { householdId: id } });
  await prisma.household.deleteMany({ where: { id } });
  await prisma.household.create({ data: { id } });
}

async function createTransaction(opts: {
  householdId: bigint;
  createdBy: bigint;
  amount: number;
  settlementPayerUserId?: bigint | null;
  settlementBurden?: 'half' | 'other_full' | null;
  settlementPartialAmount?: number | null;
}) {
  await prisma.transaction.create({
    data: {
      householdId: opts.householdId,
      transactionDate: new Date(Date.UTC(YEAR, MONTH - 1, 10)),
      categoryId,
      splitType: 'self',
      userId: opts.createdBy,
      amount: opts.amount,
      createdBy: opts.createdBy,
      settlementPayerUserId: opts.settlementPayerUserId ?? null,
      settlementBurden: opts.settlementBurden ?? null,
      settlementPartialAmount: opts.settlementPartialAmount ?? null,
    },
  });
}

beforeAll(async () => {
  await prisma.auditLog.deleteMany({ where: { householdId: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } } });
  await resetHousehold(TEST_HOUSEHOLD_ID);
  await resetHousehold(OTHER_HOUSEHOLD_ID);
  await prisma.user.deleteMany({ where: { id: { in: [USER_A, USER_B] } } });
  await prisma.user.createMany({
    data: [
      { id: USER_A, householdId: TEST_HOUSEHOLD_ID, displayName: 'たいよう', email: `user${USER_A}@test.local`, passwordHash: 'test-hash' },
      { id: USER_B, householdId: TEST_HOUSEHOLD_ID, displayName: 'みらの', email: `user${USER_B}@test.local`, passwordHash: 'test-hash' },
    ],
  });
  const category = await prisma.category.create({
    data: { householdId: TEST_HOUSEHOLD_ID, type: 'variable_expense', name: '食費', icon: '🍙' },
  });
  categoryId = category.id;
});

beforeEach(async () => {
  await prisma.transaction.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.transaction.deleteMany({ where: { householdId: OTHER_HOUSEHOLD_ID } });
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { householdId: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } } });
  await prisma.transaction.deleteMany({ where: { householdId: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } } });
  await prisma.category.deleteMany({ where: { householdId: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } } });
  await prisma.user.deleteMany({ where: { id: { in: [USER_A, USER_B] } } });
  await prisma.household.deleteMany({ where: { id: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } } });
});

describe('GET /api/v1/settlements', () => {
  it('未認証は401', async () => {
    const res = await request(app).get('/api/v1/settlements').query({ year: YEAR, month: MONTH });
    expect(res.status).toBe(401);
  });

  it('year・month不正は400', async () => {
    const res = await request(app)
      .get('/api/v1/settlements')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A))
      .query({ year: YEAR, month: 13 });
    expect(res.status).toBe(400);
  });

  it('世帯人数が2人でない場合は400', async () => {
    const res = await request(app)
      .get('/api/v1/settlements')
      .set('Authorization', authHeader(OTHER_HOUSEHOLD_ID, USER_A))
      .query({ year: YEAR, month: MONTH });
    expect(res.status).toBe(400);
  });

  it('精算不要（マーカー取引なし）はNONEで返す', async () => {
    const res = await request(app)
      .get('/api/v1/settlements')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A))
      .query({ year: YEAR, month: MONTH });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      year: YEAR,
      month: MONTH,
      direction: 'NONE',
      fromUser: null,
      toUser: null,
      amount: 0,
      transactionCount: 0,
    });
  });

  it('4章のレスポンス形式に厳密に従う（折半・全額立替の混在、A_TO_B方向）', async () => {
    // ☀：Aが折半払い（80000円）
    await createTransaction({
      householdId: TEST_HOUSEHOLD_ID,
      createdBy: USER_A,
      amount: 80000,
      settlementPayerUserId: USER_A,
      settlementBurden: 'half',
    });
    // ☆：Bが折半払い（25000円）
    await createTransaction({
      householdId: TEST_HOUSEHOLD_ID,
      createdBy: USER_B,
      amount: 25000,
      settlementPayerUserId: USER_B,
      settlementBurden: 'half',
    });

    const res = await request(app)
      .get('/api/v1/settlements')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A))
      .query({ year: YEAR, month: MONTH });

    expect(res.status).toBe(200);
    // 折半合計105000、fairShare=52500、Aの拠出額=80000 → Aの負担超過分=27500がBからAへ支払われる
    expect(res.body).toEqual({
      year: YEAR,
      month: MONTH,
      direction: 'B_TO_A',
      fromUser: { userId: USER_B.toString(), displayName: 'みらの' },
      toUser: { userId: USER_A.toString(), displayName: 'たいよう' },
      amount: 27500,
      breakdown: {
        halfSplit: {
          totalAmount: 105000,
          fairShare: 52500,
          contributedByFrom: 25000,
          subtotal: 27500,
        },
        otherFull: {
          subtotal: 0,
        },
      },
      transactionCount: 2,
    });
  });

  it('他世帯のマーカー取引は集計に含まれない', async () => {
    await createTransaction({
      householdId: TEST_HOUSEHOLD_ID,
      createdBy: USER_A,
      amount: 1000,
      settlementPayerUserId: USER_A,
      settlementBurden: 'other_full',
    });
    // 他世帯側のダミー取引（categoryIdはTEST_HOUSEHOLD_ID用だが集計対象外であることの確認が目的のため
    // householdIdだけ差し替えて紛れ込みがないかを見る）
    await prisma.transaction.create({
      data: {
        householdId: OTHER_HOUSEHOLD_ID,
        transactionDate: new Date(Date.UTC(YEAR, MONTH - 1, 10)),
        categoryId,
        splitType: 'self',
        userId: USER_A,
        amount: 999999,
        createdBy: USER_A,
        settlementPayerUserId: USER_A,
        settlementBurden: 'other_full',
      },
    });

    const res = await request(app)
      .get('/api/v1/settlements')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A))
      .query({ year: YEAR, month: MONTH });

    expect(res.status).toBe(200);
    expect(res.body.transactionCount).toBe(1);
    expect(res.body.amount).toBe(1000);
  });
});
