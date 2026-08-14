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
let incomeCategoryId: bigint;

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
      {
        categoryId: fixedCategoryId.toString(),
        icon: '🔥',
        name: '光熱費',
        amounts: { [USER_A.toString()]: 8000, [USER_B.toString()]: 8000 },
      },
    ]);
    expect(res.body.variableExpenseByCategory).toEqual([
      {
        categoryId: variableCategoryId.toString(),
        icon: '🍙',
        name: '食費',
        amounts: { [USER_A.toString()]: 21000, [USER_B.toString()]: 20001 },
      },
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
      {
        categoryId: fixedCategoryId.toString(),
        icon: '🔥',
        name: '光熱費',
        amounts: { [USER_A.toString()]: 0, [USER_B.toString()]: 0 },
      },
    ]);
    expect(res.body.variableExpenseByCategory).toEqual([
      {
        categoryId: variableCategoryId.toString(),
        icon: '🍙',
        name: '食費',
        amounts: { [USER_A.toString()]: 0, [USER_B.toString()]: 0 },
      },
    ]);
  });

  it('収入が0の場合、remainingSaving・totalSavingはpreSaving・expenseのみで計算される', async () => {
    await prisma.income.deleteMany({
      where: { householdId: TEST_HOUSEHOLD_ID, month: TARGET_MONTH },
    });

    const res = await request(app)
      .get(`/api/v1/summary/monthly?year=${currentYear}&month=${TARGET_MONTH}`)
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    expect(res.status).toBe(200);

    const memberA = res.body.members.find((m: { userId: string }) => m.userId === USER_A.toString());
    expect(memberA).toMatchObject({
      income: 0,
      preSaving: 50000,
      expense: 0,
      remainingSaving: -50000,
      totalSaving: 0,
    });
  });
});

describe('GET /api/v1/summary/annual', () => {
  beforeAll(async () => {
    const incomeCategory = await prisma.category.create({
      data: { householdId: TEST_HOUSEHOLD_ID, type: 'income', name: '給与', icon: '🔥' },
    });
    incomeCategoryId = incomeCategory.id;
  });

  beforeEach(async () => {
    await prisma.transaction.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
    await prisma.income.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
    await prisma.preSaving.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  });

  it('x-household-idヘッダーがない場合は401', async () => {
    const res = await request(app).get(`/api/v1/summary/annual?year=${currentYear}`);
    expect(res.status).toBe(401);
  });

  it('yearがない場合は400', async () => {
    const res = await request(app)
      .get('/api/v1/summary/annual')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    expect(res.status).toBe(400);
  });

  it('12ヶ月すべてデータがある場合、月別内訳と年間合計が正しく計算される', async () => {
    for (let month = 1; month <= 12; month++) {
      await prisma.income.create({
        data: {
          householdId: TEST_HOUSEHOLD_ID,
          year: currentYear,
          month,
          userId: USER_A,
          categoryId: incomeCategoryId,
          amount: 1000 * month,
        },
      });
      await prisma.transaction.create({
        data: {
          householdId: TEST_HOUSEHOLD_ID,
          transactionDate: new Date(Date.UTC(currentYear, month - 1, 10)),
          categoryId: variableCategoryId,
          splitType: 'self',
          userId: USER_A,
          amount: 100 * month,
          createdBy: USER_A,
        },
      });
    }

    const res = await request(app)
      .get(`/api/v1/summary/annual?year=${currentYear}`)
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    expect(res.status).toBe(200);
    expect(res.body.year).toBe(currentYear);

    const incomeRowA = res.body.rows.find(
      (r: { categoryType: string; userId: string }) =>
        r.categoryType === 'income' && r.userId === USER_A.toString()
    );
    expect(incomeRowA).toMatchObject({
      categoryName: '🔥給与',
      displayName: 'たいよう',
      months: [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000],
      annualTotal: 78000,
    });

    const variableRowA = res.body.rows.find(
      (r: { categoryType: string; userId: string }) =>
        r.categoryType === 'variable_expense' && r.userId === USER_A.toString()
    );
    expect(variableRowA).toMatchObject({
      categoryName: '🍙食費',
      months: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200],
      annualTotal: 7800,
    });
  });

  it('一部月のデータがない場合、その月は0円として埋められる', async () => {
    await prisma.income.create({
      data: {
        householdId: TEST_HOUSEHOLD_ID,
        year: currentYear,
        month: TARGET_MONTH,
        userId: USER_A,
        categoryId: incomeCategoryId,
        amount: 5000,
      },
    });

    const res = await request(app)
      .get(`/api/v1/summary/annual?year=${currentYear}`)
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    expect(res.status).toBe(200);

    const incomeRowA = res.body.rows.find(
      (r: { categoryType: string; userId: string }) =>
        r.categoryType === 'income' && r.userId === USER_A.toString()
    );
    const expectedMonths = new Array(12).fill(0);
    expectedMonths[TARGET_MONTH - 1] = 5000;
    expect(incomeRowA.months).toEqual(expectedMonths);
    expect(incomeRowA.annualTotal).toBe(5000);

    const incomeRowB = res.body.rows.find(
      (r: { categoryType: string; userId: string }) =>
        r.categoryType === 'income' && r.userId === USER_B.toString()
    );
    expect(incomeRowB.months).toEqual(new Array(12).fill(0));
    expect(incomeRowB.annualTotal).toBe(0);
  });
});

describe('GET /api/v1/summary/visualization', () => {
  beforeEach(async () => {
    await prisma.transaction.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
    await prisma.income.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
    await prisma.preSaving.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  });

  it('x-household-idヘッダーがない場合は401', async () => {
    const res = await request(app).get(`/api/v1/summary/visualization?year=${currentYear}`);
    expect(res.status).toBe(401);
  });

  it('yearがない場合は400', async () => {
    const res = await request(app)
      .get('/api/v1/summary/visualization')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    expect(res.status).toBe(400);
  });

  it('データがある月のみで月平均が算出され、年間合計・比率が正しく計算される', async () => {
    // データがあるのは2ヶ月分（1月・2月）のみ
    for (const month of [1, 2]) {
      await prisma.income.create({
        data: {
          householdId: TEST_HOUSEHOLD_ID,
          year: currentYear,
          month,
          userId: USER_A,
          categoryId: incomeCategoryId,
          amount: 100000,
        },
      });
      await prisma.transaction.create({
        data: {
          householdId: TEST_HOUSEHOLD_ID,
          transactionDate: new Date(Date.UTC(currentYear, month - 1, 10)),
          categoryId: variableCategoryId,
          splitType: 'self',
          userId: USER_A,
          amount: 40000,
          createdBy: USER_A,
        },
      });
    }

    const res = await request(app)
      .get(`/api/v1/summary/visualization?year=${currentYear}`)
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    expect(res.status).toBe(200);
    expect(res.body.year).toBe(currentYear);

    const memberA = res.body.members.find((m: { userId: string }) => m.userId === USER_A.toString());
    expect(memberA.annual).toMatchObject({
      income: 200000,
      preSaving: 0,
      expense: 80000,
      remainingSaving: 120000,
      totalSaving: 120000,
    });
    // 月平均はデータのある2ヶ月分のみで割る（12ヶ月ではない）
    expect(memberA.monthlyAverage).toMatchObject({
      income: 100000,
      preSaving: 0,
      fixedExpense: 0,
      variableExpense: 40000,
      remainingSaving: 60000,
      totalSaving: 60000,
    });
    expect(memberA.bonusAverage).toBe(0);
    // 比率は年間ベース：expense 80000 / income 200000 = 40%、totalSaving 120000 / income 200000 = 60%
    expect(memberA.expenseRatio).toBeCloseTo(40.0);
    expect(memberA.savingRatio).toBeCloseTo(60.0);

    const janRatio = memberA.monthlyRatios.find((r: { month: number }) => r.month === 1);
    expect(janRatio.expenseRatio).toBeCloseTo(40.0);
    expect(janRatio.savingRatio).toBeCloseTo(60.0);

    // データのない月（3月）はゼロ除算ガードで0
    const marchRatio = memberA.monthlyRatios.find((r: { month: number }) => r.month === 3);
    expect(marchRatio).toMatchObject({ expenseRatio: 0, savingRatio: 0 });

    const memberB = res.body.members.find((m: { userId: string }) => m.userId === USER_B.toString());
    expect(memberB.annual).toMatchObject({
      income: 0,
      preSaving: 0,
      expense: 0,
      remainingSaving: 0,
      totalSaving: 0,
    });
    expect(memberB.monthlyAverage).toMatchObject({
      income: 0,
      preSaving: 0,
      fixedExpense: 0,
      variableExpense: 0,
      remainingSaving: 0,
      totalSaving: 0,
    });
    expect(memberB.bonusAverage).toBe(0);
    expect(memberB.expenseRatio).toBe(0);
    expect(memberB.savingRatio).toBe(0);
  });

  it('賞与費目（💰賞与）の収入は月平均から除外され、年間合計÷2がbonusAverageとして返る', async () => {
    const bonusCategory = await prisma.category.create({
      data: { householdId: TEST_HOUSEHOLD_ID, type: 'income', name: '賞与', icon: '💰' },
    });
    try {
      // 通常収入（1月・2月）
      for (const month of [1, 2]) {
        await prisma.income.create({
          data: {
            householdId: TEST_HOUSEHOLD_ID,
            year: currentYear,
            month,
            userId: USER_A,
            categoryId: incomeCategoryId,
            amount: 100000,
          },
        });
      }
      // 賞与（6月・12月）
      for (const month of [6, 12]) {
        await prisma.income.create({
          data: {
            householdId: TEST_HOUSEHOLD_ID,
            year: currentYear,
            month,
            userId: USER_A,
            categoryId: bonusCategory.id,
            amount: 300000,
          },
        });
      }

      const res = await request(app)
        .get(`/api/v1/summary/visualization?year=${currentYear}`)
        .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
      expect(res.status).toBe(200);

      const memberA = res.body.members.find((m: { userId: string }) => m.userId === USER_A.toString());
      // 月平均の収入は賞与を除いた1月・2月（各100000円）のみで算出：2ヶ月分の平均
      expect(memberA.monthlyAverage.income).toBe(100000);
      // 賞与は年間合計600000円 ÷ 2 = 300000円
      expect(memberA.bonusAverage).toBe(300000);
      // 年間合計（annual）は賞与も含めた全収入
      expect(memberA.annual.income).toBe(800000);
    } finally {
      await prisma.income.deleteMany({ where: { categoryId: bonusCategory.id } });
      await prisma.category.delete({ where: { id: bonusCategory.id } });
    }
  });

  it('月平均が費目ごとの内訳（incomeByCategory等）として返る', async () => {
    const preSavingCategory = await prisma.category.create({
      data: { householdId: TEST_HOUSEHOLD_ID, type: 'pre_saving', name: '積立NISA', icon: '📈' },
    });
    try {
      // データがあるのは1月・2月の2ヶ月分のみ
      for (const month of [1, 2]) {
        await prisma.income.create({
          data: {
            householdId: TEST_HOUSEHOLD_ID,
            year: currentYear,
            month,
            userId: USER_A,
            categoryId: incomeCategoryId,
            amount: 100000,
          },
        });
        await prisma.preSaving.create({
          data: {
            householdId: TEST_HOUSEHOLD_ID,
            year: currentYear,
            month,
            userId: USER_A,
            categoryId: preSavingCategory.id,
            actualAmount: 10000,
          },
        });
        await prisma.transaction.create({
          data: {
            householdId: TEST_HOUSEHOLD_ID,
            transactionDate: new Date(Date.UTC(currentYear, month - 1, 10)),
            categoryId: fixedCategoryId,
            splitType: 'self',
            userId: USER_A,
            amount: 8000,
            createdBy: USER_A,
          },
        });
        await prisma.transaction.create({
          data: {
            householdId: TEST_HOUSEHOLD_ID,
            transactionDate: new Date(Date.UTC(currentYear, month - 1, 15)),
            categoryId: variableCategoryId,
            splitType: 'self',
            userId: USER_A,
            amount: 40000,
            createdBy: USER_A,
          },
        });
      }

      const res = await request(app)
        .get(`/api/v1/summary/visualization?year=${currentYear}`)
        .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
      expect(res.status).toBe(200);

      const memberA = res.body.members.find((m: { userId: string }) => m.userId === USER_A.toString());
      expect(memberA.monthlyAverage.incomeByCategory).toContainEqual({
        categoryId: incomeCategoryId.toString(),
        icon: '🔥',
        name: '給与',
        amount: 100000,
      });
      expect(memberA.monthlyAverage.preSavingByCategory).toContainEqual({
        categoryId: preSavingCategory.id.toString(),
        icon: '📈',
        name: '積立NISA',
        amount: 10000,
      });
      expect(memberA.monthlyAverage.fixedExpenseByCategory).toContainEqual({
        categoryId: fixedCategoryId.toString(),
        icon: '🔥',
        name: '光熱費',
        amount: 8000,
      });
      expect(memberA.monthlyAverage.variableExpenseByCategory).toContainEqual({
        categoryId: variableCategoryId.toString(),
        icon: '🍙',
        name: '食費',
        amount: 40000,
      });
    } finally {
      await prisma.preSaving.deleteMany({ where: { categoryId: preSavingCategory.id } });
      await prisma.category.delete({ where: { id: preSavingCategory.id } });
    }
  });

  it('対象年にデータが0件の場合、年間合計・月平均・比率はすべて0になる（分母0ガード）', async () => {
    const res = await request(app)
      .get(`/api/v1/summary/visualization?year=${currentYear}`)
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    expect(res.status).toBe(200);

    for (const member of res.body.members) {
      expect(member.annual).toMatchObject({
        income: 0,
        preSaving: 0,
        expense: 0,
        remainingSaving: 0,
        totalSaving: 0,
      });
      expect(member.monthlyAverage).toMatchObject({
        income: 0,
        preSaving: 0,
        fixedExpense: 0,
        variableExpense: 0,
        remainingSaving: 0,
        totalSaving: 0,
      });
      expect(member.bonusAverage).toBe(0);
      expect(member.expenseRatio).toBe(0);
      expect(member.savingRatio).toBe(0);
      expect(member.monthlyRatios).toHaveLength(12);
      for (const ratio of member.monthlyRatios) {
        expect(ratio.expenseRatio).toBe(0);
        expect(ratio.savingRatio).toBe(0);
      }
    }
  });
});
