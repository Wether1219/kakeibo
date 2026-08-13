import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const TEST_HOUSEHOLD_ID = 999969n;
const OTHER_HOUSEHOLD_ID = 999968n;
const USER_A = 999967n; // たいよう
const USER_B = 999966n; // みらの
const app = createApp();

// 2024年3月：1日が金曜のため第1週が短縮、31日（日）が第6週になる境界月（summaryLogic.test.tsと同じ月）。
const YEAR = 2024;
const MONTH = 3;

let variableCategoryId: string;
let incomeCategoryId: string;

async function resetHousehold(id: bigint) {
  await prisma.weeklyBudget.deleteMany({ where: { householdId: id } });
  await prisma.transaction.deleteMany({ where: { householdId: id } });
  await prisma.category.deleteMany({ where: { householdId: id } });
  await prisma.user.deleteMany({ where: { householdId: id } });
  await prisma.household.deleteMany({ where: { id } });
  await prisma.household.create({ data: { id } });
}

beforeAll(async () => {
  await resetHousehold(TEST_HOUSEHOLD_ID);
  await resetHousehold(OTHER_HOUSEHOLD_ID);
  await prisma.user.deleteMany({ where: { id: { in: [USER_A, USER_B] } } });
  await prisma.user.createMany({
    data: [
      { id: USER_A, householdId: TEST_HOUSEHOLD_ID, displayName: 'たいよう' },
      { id: USER_B, householdId: TEST_HOUSEHOLD_ID, displayName: 'みらの' },
    ],
  });
  const variableCategory = await prisma.category.create({
    data: { householdId: TEST_HOUSEHOLD_ID, type: 'variable_expense', name: '食費', icon: '🍙' },
  });
  variableCategoryId = variableCategory.id.toString();
  const incomeCategory = await prisma.category.create({
    data: { householdId: TEST_HOUSEHOLD_ID, type: 'income', name: '給与' },
  });
  incomeCategoryId = incomeCategory.id.toString();
});

beforeEach(async () => {
  await prisma.weeklyBudget.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.weeklyBudget.deleteMany({ where: { householdId: OTHER_HOUSEHOLD_ID } });
  await prisma.transaction.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.transaction.deleteMany({ where: { householdId: OTHER_HOUSEHOLD_ID } });
});

afterAll(async () => {
  await prisma.weeklyBudget.deleteMany({
    where: { householdId: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } },
  });
  await prisma.transaction.deleteMany({
    where: { householdId: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } },
  });
  await prisma.category.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.user.deleteMany({ where: { id: { in: [USER_A, USER_B] } } });
  await prisma.household.deleteMany({ where: { id: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } } });
  await prisma.$disconnect();
});

function baseItem(overrides: Record<string, unknown> = {}) {
  return {
    year: YEAR,
    month: MONTH,
    weekNo: 1,
    categoryId: variableCategoryId,
    budgetAmount: 5000,
    ...overrides,
  };
}

describe('/api/v1/weekly-budgets', () => {
  it('x-household-idヘッダーがない場合は401', async () => {
    const res = await request(app).get(`/api/v1/weekly-budgets?year=${YEAR}&month=${MONTH}`);
    expect(res.status).toBe(401);
  });

  it('year・monthがない場合は400', async () => {
    const res = await request(app)
      .get('/api/v1/weekly-budgets')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    expect(res.status).toBe(400);
  });

  it('一括登録して一覧取得できる（更新も新規作成にならない）', async () => {
    const putRes = await request(app)
      .put('/api/v1/weekly-budgets/bulk')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .send([baseItem(), baseItem({ weekNo: 2, budgetAmount: 3000 })]);
    expect(putRes.status).toBe(200);
    expect(putRes.body).toHaveLength(2);
    expect(putRes.body[0]).toMatchObject({
      year: YEAR,
      month: MONTH,
      weekNo: 1,
      categoryId: variableCategoryId,
      budgetAmount: 5000,
    });

    const updateRes = await request(app)
      .put('/api/v1/weekly-budgets/bulk')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .send([baseItem({ budgetAmount: 6000 })]);
    expect(updateRes.body).toHaveLength(1);
    expect(updateRes.body[0].budgetAmount).toBe(6000);

    const listRes = await request(app)
      .get(`/api/v1/weekly-budgets?year=${YEAR}&month=${MONTH}`)
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    expect(listRes.status).toBe(200);
    const week1 = listRes.body.find((r: { weekNo: number }) => r.weekNo === 1);
    expect(week1.budgetAmount).toBe(6000);
  });

  it('type=variable_expense以外の費目は400', async () => {
    const res = await request(app)
      .put('/api/v1/weekly-budgets/bulk')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .send([baseItem({ categoryId: incomeCategoryId })]);
    expect(res.status).toBe(400);
  });

  it('weekNoが範囲外（0または7）は400', async () => {
    const resZero = await request(app)
      .put('/api/v1/weekly-budgets/bulk')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .send([baseItem({ weekNo: 0 })]);
    expect(resZero.status).toBe(400);

    const resSeven = await request(app)
      .put('/api/v1/weekly-budgets/bulk')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .send([baseItem({ weekNo: 7 })]);
    expect(resSeven.status).toBe(400);
  });

  it('他世帯のデータは一覧に表示されない', async () => {
    const otherCategory = await prisma.category.create({
      data: { householdId: OTHER_HOUSEHOLD_ID, type: 'variable_expense', name: '日用品' },
    });
    await request(app)
      .put('/api/v1/weekly-budgets/bulk')
      .set('x-household-id', OTHER_HOUSEHOLD_ID.toString())
      .send([baseItem({ categoryId: otherCategory.id.toString() })]);

    const listRes = await request(app)
      .get(`/api/v1/weekly-budgets?year=${YEAR}&month=${MONTH}`)
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    expect(listRes.status).toBe(200);
    expect(listRes.body.every((r: { budgetAmount: number }) => r.budgetAmount === 0)).toBe(true);

    await prisma.weeklyBudget.deleteMany({ where: { householdId: OTHER_HOUSEHOLD_ID } });
    await prisma.category.deleteMany({ where: { householdId: OTHER_HOUSEHOLD_ID } });
  });

  it('実績は既存の按分ロジック（5.1）で世帯合計として集計され、月末を含む週まで（第6週まで）表示される', async () => {
    await request(app)
      .put('/api/v1/weekly-budgets/bulk')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .send([
        baseItem({ weekNo: 1, budgetAmount: 1000 }),
        baseItem({ weekNo: 2, budgetAmount: 800 }),
      ]);

    // 第1週（3/1金〜3/2土）：本人分のみ
    await prisma.transaction.create({
      data: {
        householdId: TEST_HOUSEHOLD_ID,
        transactionDate: new Date(Date.UTC(YEAR, MONTH - 1, 2)),
        categoryId: BigInt(variableCategoryId),
        splitType: 'self',
        userId: USER_A,
        amount: 500,
        createdBy: USER_A,
      },
    });
    // 第2週（3/3日〜3/9土）：折半（偶数円）
    await prisma.transaction.create({
      data: {
        householdId: TEST_HOUSEHOLD_ID,
        transactionDate: new Date(Date.UTC(YEAR, MONTH - 1, 5)),
        categoryId: BigInt(variableCategoryId),
        splitType: 'shared',
        userId: null,
        amount: 1000,
        createdBy: USER_A,
      },
    });
    // 第6週（3/31日、月末境界）：本人分のみ。予算未登録の週でも実績は表示される
    await prisma.transaction.create({
      data: {
        householdId: TEST_HOUSEHOLD_ID,
        transactionDate: new Date(Date.UTC(YEAR, MONTH - 1, 31)),
        categoryId: BigInt(variableCategoryId),
        splitType: 'self',
        userId: USER_B,
        amount: 300,
        createdBy: USER_B,
      },
    });

    const res = await request(app)
      .get(`/api/v1/weekly-budgets?year=${YEAR}&month=${MONTH}`)
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    expect(res.status).toBe(200);

    const byWeek = (weekNo: number) =>
      res.body.find(
        (r: { weekNo: number; categoryId: string }) =>
          r.weekNo === weekNo && r.categoryId === variableCategoryId
      );

    expect(byWeek(1)).toMatchObject({ budgetAmount: 1000, actualAmount: 500, diff: 500 });
    expect(byWeek(2)).toMatchObject({ budgetAmount: 800, actualAmount: 1000, diff: -200 });
    expect(byWeek(3)).toMatchObject({ budgetAmount: 0, actualAmount: 0, diff: 0 });
    expect(byWeek(6)).toMatchObject({ budgetAmount: 0, actualAmount: 300, diff: -300 });

    // 3月は第6週まで（4/1以降の第7週は含まれない）
    expect(res.body.some((r: { weekNo: number }) => r.weekNo > 6)).toBe(false);
  });
});
