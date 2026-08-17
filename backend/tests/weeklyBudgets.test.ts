import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';
import { authHeader } from './helpers/auth';

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
let furusatoCategoryId: string;

async function resetHousehold(id: bigint) {
  await prisma.auditLog.deleteMany({ where: { householdId: id } });
  await prisma.weeklyBudget.deleteMany({ where: { householdId: id } });
  await prisma.transaction.deleteMany({ where: { householdId: id } });
  await prisma.category.deleteMany({ where: { householdId: id } });
  await prisma.user.deleteMany({ where: { householdId: id } });
  await prisma.household.deleteMany({ where: { id } });
  await prisma.household.create({ data: { id } });
}

beforeAll(async () => {
  // OTHER_HOUSEHOLD_ID宛のテストでもUSER_A/USER_Bを操作者として使うため、
  // どちらかのhouseholdIdだけでresetすると相手側に残る監査ログのFKで失敗しうる。先に両方分をまとめて削除する。
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
  const variableCategory = await prisma.category.create({
    data: { householdId: TEST_HOUSEHOLD_ID, type: 'variable_expense', name: '食費', icon: '🍙' },
  });
  variableCategoryId = variableCategory.id.toString();
  const incomeCategory = await prisma.category.create({
    data: { householdId: TEST_HOUSEHOLD_ID, type: 'income', name: '給与' },
  });
  incomeCategoryId = incomeCategory.id.toString();
  const furusatoCategory = await prisma.category.create({
    data: { householdId: TEST_HOUSEHOLD_ID, type: 'variable_expense', name: 'ふるさと納税', icon: '🌾' },
  });
  furusatoCategoryId = furusatoCategory.id.toString();
});

beforeEach(async () => {
  await prisma.weeklyBudget.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.weeklyBudget.deleteMany({ where: { householdId: OTHER_HOUSEHOLD_ID } });
  await prisma.transaction.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.transaction.deleteMany({ where: { householdId: OTHER_HOUSEHOLD_ID } });
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { householdId: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } } });
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
  it('Authorizationヘッダーがない場合は401', async () => {
    const res = await request(app).get(`/api/v1/weekly-budgets?year=${YEAR}&month=${MONTH}`);
    expect(res.status).toBe(401);
  });

  it('year・monthがない場合は400', async () => {
    const res = await request(app)
      .get('/api/v1/weekly-budgets')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A));
    expect(res.status).toBe(400);
  });

  it('一括登録して一覧取得できる（更新も新規作成にならない）', async () => {
    const putRes = await request(app)
      .put('/api/v1/weekly-budgets/bulk')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A))
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
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A))
      .send([baseItem({ budgetAmount: 6000 })]);
    expect(updateRes.body).toHaveLength(1);
    expect(updateRes.body[0].budgetAmount).toBe(6000);

    const listRes = await request(app)
      .get(`/api/v1/weekly-budgets?year=${YEAR}&month=${MONTH}`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A));
    expect(listRes.status).toBe(200);
    const week1 = listRes.body.find(
      (r: { weekNo: number; categoryId: string }) => r.weekNo === 1 && r.categoryId === variableCategoryId
    );
    expect(week1.budgetAmount).toBe(6000);
  });

  it('type=variable_expense以外の費目は400', async () => {
    const res = await request(app)
      .put('/api/v1/weekly-budgets/bulk')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A))
      .send([baseItem({ categoryId: incomeCategoryId })]);
    expect(res.status).toBe(400);
  });

  it('一部のみtype不一致の場合、バッチ全体が失敗し有効な項目も保存されない（費目の一括検証はitemごとに逐次DBアクセスせず事前に一括取得する）', async () => {
    const res = await request(app)
      .put('/api/v1/weekly-budgets/bulk')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A))
      .send([baseItem({ weekNo: 3, budgetAmount: 9999 }), baseItem({ categoryId: incomeCategoryId })]);
    expect(res.status).toBe(400);

    const listRes = await request(app)
      .get(`/api/v1/weekly-budgets?year=${YEAR}&month=${MONTH}`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A));
    const week3 = listRes.body.find(
      (r: { weekNo: number; categoryId: string }) => r.weekNo === 3 && r.categoryId === variableCategoryId
    );
    expect(week3?.budgetAmount ?? 0).toBe(0);
  });

  it('weekNoが範囲外（0または7）は400', async () => {
    const resZero = await request(app)
      .put('/api/v1/weekly-budgets/bulk')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A))
      .send([baseItem({ weekNo: 0 })]);
    expect(resZero.status).toBe(400);

    const resSeven = await request(app)
      .put('/api/v1/weekly-budgets/bulk')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A))
      .send([baseItem({ weekNo: 7 })]);
    expect(resSeven.status).toBe(400);
  });

  it('他世帯のデータは一覧に表示されない', async () => {
    const otherCategory = await prisma.category.create({
      data: { householdId: OTHER_HOUSEHOLD_ID, type: 'variable_expense', name: '日用品' },
    });
    await request(app)
      .put('/api/v1/weekly-budgets/bulk')
      .set('Authorization', authHeader(OTHER_HOUSEHOLD_ID, USER_A))
      .send([baseItem({ categoryId: otherCategory.id.toString() })]);

    const listRes = await request(app)
      .get(`/api/v1/weekly-budgets?year=${YEAR}&month=${MONTH}`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A));
    expect(listRes.status).toBe(200);
    expect(listRes.body.every((r: { budgetAmount: number }) => r.budgetAmount === 0)).toBe(true);

    await prisma.weeklyBudget.deleteMany({ where: { householdId: OTHER_HOUSEHOLD_ID } });
    await prisma.category.deleteMany({ where: { householdId: OTHER_HOUSEHOLD_ID } });
  });

  it('実績は既存の按分ロジック（5.1）で世帯合計として集計され、月末を含む週まで（第6週まで）表示される', async () => {
    await request(app)
      .put('/api/v1/weekly-budgets/bulk')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A))
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
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A));
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

  it('未入力の費目は年間推移（1月〜前月）の実績から自動算出した金額が週の日数比で入り、hasBudget=falseになる', async () => {
    // 1月・2月（60日間）で合計1200円 → 日次平均20円 × 3月31日 = 620円を、週の日数比（2/7/7/7/7/1）で配分
    await prisma.transaction.create({
      data: {
        householdId: TEST_HOUSEHOLD_ID,
        transactionDate: new Date(Date.UTC(YEAR, 0, 15)),
        categoryId: BigInt(variableCategoryId),
        splitType: 'self',
        userId: USER_A,
        amount: 600,
        createdBy: USER_A,
      },
    });
    await prisma.transaction.create({
      data: {
        householdId: TEST_HOUSEHOLD_ID,
        transactionDate: new Date(Date.UTC(YEAR, 1, 10)),
        categoryId: BigInt(variableCategoryId),
        splitType: 'self',
        userId: USER_A,
        amount: 600,
        createdBy: USER_A,
      },
    });

    const res = await request(app)
      .get(`/api/v1/weekly-budgets?year=${YEAR}&month=${MONTH}`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A));
    expect(res.status).toBe(200);

    const byWeek = (weekNo: number) =>
      res.body.find(
        (r: { weekNo: number; categoryId: string }) =>
          r.weekNo === weekNo && r.categoryId === variableCategoryId
      );

    expect(byWeek(1)).toMatchObject({ hasBudget: false, suggestedAmount: 40, budgetAmount: 0 });
    expect(byWeek(2)).toMatchObject({ hasBudget: false, suggestedAmount: 140, budgetAmount: 0 });
    expect(byWeek(6)).toMatchObject({ hasBudget: false, suggestedAmount: 20, budgetAmount: 0 });
  });

  it('1月は年内に前月データが無いため、直近12ヶ月（前年1月〜前年12月）の実績を参照する', async () => {
    // 前年（2023年、365日）に合計600円 → 日次平均約1.6438円 × 1月31日 = 51円を、
    // 2024年1月の週の日数比（6/7/7/7/4）で配分（端数は最終週へ）
    await prisma.transaction.create({
      data: {
        householdId: TEST_HOUSEHOLD_ID,
        transactionDate: new Date(Date.UTC(YEAR - 1, 11, 15)),
        categoryId: BigInt(variableCategoryId),
        splitType: 'self',
        userId: USER_A,
        amount: 600,
        createdBy: USER_A,
      },
    });

    const res = await request(app)
      .get(`/api/v1/weekly-budgets?year=${YEAR}&month=1`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A));
    expect(res.status).toBe(200);

    const byWeek = (weekNo: number) =>
      res.body.find(
        (r: { weekNo: number; categoryId: string }) =>
          r.weekNo === weekNo && r.categoryId === variableCategoryId
      );

    expect(byWeek(1)).toMatchObject({ hasBudget: false, suggestedAmount: 9 });
    expect(byWeek(2)).toMatchObject({ hasBudget: false, suggestedAmount: 11 });
    expect(byWeek(5)).toMatchObject({ hasBudget: false, suggestedAmount: 9 });

    const total = [1, 2, 3, 4, 5].reduce((sum, w) => sum + byWeek(w).suggestedAmount, 0);
    expect(total).toBe(51);
  });

  it('1月かつ前年データが無い場合はsuggestedAmountが0になる', async () => {
    const res = await request(app)
      .get(`/api/v1/weekly-budgets?year=${YEAR}&month=1`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A));
    expect(res.status).toBe(200);
    expect(
      res.body.every((r: { suggestedAmount: number }) => r.suggestedAmount === 0)
    ).toBe(true);
  });

  it('DBに0円で保存済みのセルも未入力扱いとなり、自動算出値がsuggestedAmountとして返る（hasBudget=false）', async () => {
    // 過去の一括保存で全セルに0円が保存されるケース（save()は編集していないセルも含め全件送信するため）を再現
    await request(app)
      .put('/api/v1/weekly-budgets/bulk')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A))
      .send([baseItem({ weekNo: 1, budgetAmount: 0 })]);

    const res = await request(app)
      .get(`/api/v1/weekly-budgets?year=${YEAR}&month=${MONTH}`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A));

    const week1 = res.body.find(
      (r: { weekNo: number; categoryId: string }) =>
        r.weekNo === 1 && r.categoryId === variableCategoryId
    );
    expect(week1).toMatchObject({ hasBudget: false, budgetAmount: 0 });
  });

  it('既に保存済みの費目はhasBudget=trueになり、自動算出値ではなく保存値が返る', async () => {
    await request(app)
      .put('/api/v1/weekly-budgets/bulk')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A))
      .send([baseItem({ weekNo: 1, budgetAmount: 999 })]);

    const res = await request(app)
      .get(`/api/v1/weekly-budgets?year=${YEAR}&month=${MONTH}`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A));

    const week1 = res.body.find(
      (r: { weekNo: number; categoryId: string }) =>
        r.weekNo === 1 && r.categoryId === variableCategoryId
    );
    expect(week1).toMatchObject({ hasBudget: true, budgetAmount: 999 });
  });

  it('ふるさと納税は「前年合計－当年（前月まで）使用分」の残り枠が第1週にまとめて表示される', async () => {
    // 前年（2023年）合計30000円
    await prisma.transaction.create({
      data: {
        householdId: TEST_HOUSEHOLD_ID,
        transactionDate: new Date(Date.UTC(YEAR - 1, 10, 1)),
        categoryId: BigInt(furusatoCategoryId),
        splitType: 'self',
        userId: USER_A,
        amount: 30000,
        createdBy: USER_A,
      },
    });
    // 当年（2024年1月〜前月=2月）に既に10000円使用済み
    await prisma.transaction.create({
      data: {
        householdId: TEST_HOUSEHOLD_ID,
        transactionDate: new Date(Date.UTC(YEAR, 0, 10)),
        categoryId: BigInt(furusatoCategoryId),
        splitType: 'self',
        userId: USER_A,
        amount: 10000,
        createdBy: USER_A,
      },
    });

    const res = await request(app)
      .get(`/api/v1/weekly-budgets?year=${YEAR}&month=${MONTH}`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A));
    expect(res.status).toBe(200);

    const byWeek = (weekNo: number) =>
      res.body.find(
        (r: { weekNo: number; categoryId: string }) =>
          r.weekNo === weekNo && r.categoryId === furusatoCategoryId
      );

    // 残り枠 = 30000 - 10000 = 20000円、第1週にまとめて表示、他週は0円
    expect(byWeek(1)).toMatchObject({ hasBudget: false, suggestedAmount: 20000 });
    expect(byWeek(2)).toMatchObject({ suggestedAmount: 0 });
    expect(byWeek(6)).toMatchObject({ suggestedAmount: 0 });
  });

  it('ふるさと納税で当年使用分が前年合計を超えている場合はマイナスにならず0円になる', async () => {
    await prisma.transaction.create({
      data: {
        householdId: TEST_HOUSEHOLD_ID,
        transactionDate: new Date(Date.UTC(YEAR - 1, 10, 1)),
        categoryId: BigInt(furusatoCategoryId),
        splitType: 'self',
        userId: USER_A,
        amount: 10000,
        createdBy: USER_A,
      },
    });
    await prisma.transaction.create({
      data: {
        householdId: TEST_HOUSEHOLD_ID,
        transactionDate: new Date(Date.UTC(YEAR, 0, 10)),
        categoryId: BigInt(furusatoCategoryId),
        splitType: 'self',
        userId: USER_A,
        amount: 30000,
        createdBy: USER_A,
      },
    });

    const res = await request(app)
      .get(`/api/v1/weekly-budgets?year=${YEAR}&month=${MONTH}`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A));

    const week1 = res.body.find(
      (r: { weekNo: number; categoryId: string }) =>
        r.weekNo === 1 && r.categoryId === furusatoCategoryId
    );
    expect(week1).toMatchObject({ suggestedAmount: 0 });
  });
});
