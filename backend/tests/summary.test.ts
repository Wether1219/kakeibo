import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const TEST_HOUSEHOLD_ID = 999979n;
const USER_A = 999978n; // たいよう
const USER_B = 999977n; // みらの
const app = createApp();

const currentYear = new Date().getFullYear();
const TARGET_MONTH = 5;
const EMPTY_MONTH = 6;

let fixedCategoryId: bigint;
let variableCategoryId: bigint;

beforeAll(async () => {
  await prisma.transaction.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.income.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.preSaving.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.category.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.user.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.household.deleteMany({ where: { id: TEST_HOUSEHOLD_ID } });
  await prisma.household.create({ data: { id: TEST_HOUSEHOLD_ID } });
  await prisma.user.createMany({
    data: [
      { id: USER_A, householdId: TEST_HOUSEHOLD_ID, displayName: 'たいよう' },
      { id: USER_B, householdId: TEST_HOUSEHOLD_ID, displayName: 'みらの' },
    ],
  });
  const fixedCategory = await prisma.category.create({
    data: { householdId: TEST_HOUSEHOLD_ID, type: 'fixed_expense', name: '光熱費', icon: '🔥' },
  });
  fixedCategoryId = fixedCategory.id;
  const variableCategory = await prisma.category.create({
    data: { householdId: TEST_HOUSEHOLD_ID, type: 'variable_expense', name: '食費', icon: '🍙' },
  });
  variableCategoryId = variableCategory.id;

  await prisma.income.createMany({
    data: [
      {
        householdId: TEST_HOUSEHOLD_ID,
        year: currentYear,
        month: TARGET_MONTH,
        userId: USER_A,
        categoryId: fixedCategory.id, // カテゴリ整合性はincomeService側の責務のためテストでは任意のIDでよい
        amount: 300000,
      },
    ],
  });
});

beforeEach(async () => {
  await prisma.transaction.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.income.deleteMany({
    where: { householdId: TEST_HOUSEHOLD_ID, month: TARGET_MONTH },
  });
  await prisma.preSaving.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });

  await prisma.income.createMany({
    data: [
      {
        householdId: TEST_HOUSEHOLD_ID,
        year: currentYear,
        month: TARGET_MONTH,
        userId: USER_A,
        categoryId: fixedCategoryId,
        amount: 300000,
      },
      {
        householdId: TEST_HOUSEHOLD_ID,
        year: currentYear,
        month: TARGET_MONTH,
        userId: USER_B,
        categoryId: fixedCategoryId,
        amount: 250000,
      },
    ],
  });
  await prisma.preSaving.createMany({
    data: [
      {
        householdId: TEST_HOUSEHOLD_ID,
        year: currentYear,
        month: TARGET_MONTH,
        userId: USER_A,
        categoryId: fixedCategoryId,
        actualAmount: 50000,
      },
      {
        householdId: TEST_HOUSEHOLD_ID,
        year: currentYear,
        month: TARGET_MONTH,
        userId: USER_B,
        categoryId: fixedCategoryId,
        actualAmount: 30000,
      },
    ],
  });
});

afterAll(async () => {
  await prisma.transaction.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.income.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.preSaving.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.category.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.user.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.household.deleteMany({ where: { id: TEST_HOUSEHOLD_ID } });
  await prisma.$disconnect();
});

describe('GET /api/v1/summary/monthly', () => {
  it('x-household-idヘッダーがない場合は401', async () => {
    const res = await request(app).get(
      `/api/v1/summary/monthly?year=${currentYear}&month=${TARGET_MONTH}`
    );
    expect(res.status).toBe(401);
  });

  it('year・monthがない場合は400', async () => {
    const res = await request(app)
      .get('/api/v1/summary/monthly')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    expect(res.status).toBe(400);
  });

  it('按分（端数補正込み）・収支サマリ・費目別内訳が正しく計算される', async () => {
    // 固定費：折半（偶数円）→ 8000/8000
    await prisma.transaction.create({
      data: {
        householdId: TEST_HOUSEHOLD_ID,
        transactionDate: new Date(Date.UTC(currentYear, TARGET_MONTH - 1, 10)),
        categoryId: fixedCategoryId,
        splitType: 'shared',
        userId: null,
        amount: 16000,
        createdBy: USER_A,
      },
    });
    // 変動費：折半（奇数円）→ 入力者(USER_B)に1円加算
    await prisma.transaction.create({
      data: {
        householdId: TEST_HOUSEHOLD_ID,
        transactionDate: new Date(Date.UTC(currentYear, TARGET_MONTH - 1, 15)),
        categoryId: variableCategoryId,
        splitType: 'shared',
        userId: null,
        amount: 40001,
        createdBy: USER_B,
      },
    });
    // 変動費：本人分のみ
    await prisma.transaction.create({
      data: {
        householdId: TEST_HOUSEHOLD_ID,
        transactionDate: new Date(Date.UTC(currentYear, TARGET_MONTH - 1, 20)),
        categoryId: variableCategoryId,
        splitType: 'self',
        userId: USER_A,
        amount: 1000,
        createdBy: USER_A,
      },
    });

    const res = await request(app)
      .get(`/api/v1/summary/monthly?year=${currentYear}&month=${TARGET_MONTH}`)
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    expect(res.status).toBe(200);
    expect(res.body.year).toBe(currentYear);
    expect(res.body.month).toBe(TARGET_MONTH);

    const memberA = res.body.members.find((m: { userId: string }) => m.userId === USER_A.toString());
    const memberB = res.body.members.find((m: { userId: string }) => m.userId === USER_B.toString());

    expect(memberA).toMatchObject({
      displayName: 'たいよう',
      income: 300000,
      preSaving: 50000,
      fixedExpense: 8000,
      variableExpense: 21000, // 1000(self) + 20000(shared折半分)
      expense: 29000,
      remainingSaving: 221000,
      totalSaving: 271000,
    });
    expect(memberB).toMatchObject({
      displayName: 'みらの',
      income: 250000,
      preSaving: 30000,
      fixedExpense: 8000,
      variableExpense: 20001, // floor(40001/2)=20000 + 端数1円（入力者）
      expense: 28001,
      remainingSaving: 191999,
      totalSaving: 221999,
    });

    expect(res.body.fixedExpenseByCategory).toEqual([
      { category: '🔥光熱費', たいよう: 8000, みらの: 8000 },
    ]);
    expect(res.body.variableExpenseByCategory).toEqual([
      { category: '🍙食費', たいよう: 21000, みらの: 20001 },
    ]);
  });

  it('対象月にデータが0件の場合、収支は全て0で費目別内訳は0円のカテゴリのみ返る', async () => {
    const res = await request(app)
      .get(`/api/v1/summary/monthly?year=${currentYear}&month=${EMPTY_MONTH}`)
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    expect(res.status).toBe(200);
    for (const member of res.body.members) {
      expect(member.income).toBe(0);
      expect(member.preSaving).toBe(0);
      expect(member.expense).toBe(0);
      expect(member.remainingSaving).toBe(0);
      expect(member.totalSaving).toBe(0);
    }
    expect(res.body.fixedExpenseByCategory).toEqual([
      { category: '🔥光熱費', たいよう: 0, みらの: 0 },
    ]);
    expect(res.body.variableExpenseByCategory).toEqual([
      { category: '🍙食費', たいよう: 0, みらの: 0 },
    ]);
  });
});
