import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import * as XLSX from 'xlsx';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';
import { authHeader } from './helpers/auth';

const TEST_HOUSEHOLD_ID = 999964n;
const USER_A = 999963n; // たいよう
const USER_B = 999962n; // みらの
const app = createApp();

let variableCategoryId: bigint;
let incomeCategoryId: bigint;
let preSavingCategoryId: bigint;

beforeAll(async () => {
  await prisma.weeklyBudget.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.transaction.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.income.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.preSaving.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.category.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.user.deleteMany({ where: { id: { in: [USER_A, USER_B] } } });
  await prisma.household.deleteMany({ where: { id: TEST_HOUSEHOLD_ID } });
  await prisma.household.create({ data: { id: TEST_HOUSEHOLD_ID } });
  await prisma.user.createMany({
    data: [
      { id: USER_A, householdId: TEST_HOUSEHOLD_ID, displayName: 'たいよう', email: `user${USER_A}@test.local`, passwordHash: 'test-hash' },
      { id: USER_B, householdId: TEST_HOUSEHOLD_ID, displayName: 'みらの', email: `user${USER_B}@test.local`, passwordHash: 'test-hash' },
    ],
  });

  const variableCategory = await prisma.category.create({
    data: { householdId: TEST_HOUSEHOLD_ID, type: 'variable_expense', name: '食費', icon: '🍙' },
  });
  variableCategoryId = variableCategory.id;
  const incomeCategory = await prisma.category.create({
    data: { householdId: TEST_HOUSEHOLD_ID, type: 'income', name: '給与' },
  });
  incomeCategoryId = incomeCategory.id;
  const preSavingCategory = await prisma.category.create({
    data: { householdId: TEST_HOUSEHOLD_ID, type: 'pre_saving', name: '積立NISA', icon: '📈' },
  });
  preSavingCategoryId = preSavingCategory.id;

  await prisma.transaction.create({
    data: {
      householdId: TEST_HOUSEHOLD_ID,
      transactionDate: new Date(Date.UTC(2024, 2, 2)),
      categoryId: variableCategoryId,
      splitType: 'self',
      userId: USER_A,
      amount: 500,
      memo: 'コンビニ',
      createdBy: USER_A,
    },
  });
  await prisma.income.create({
    data: {
      householdId: TEST_HOUSEHOLD_ID,
      year: 2024,
      month: 3,
      userId: USER_A,
      categoryId: incomeCategoryId,
      amount: 300000,
    },
  });
  await prisma.preSaving.create({
    data: {
      householdId: TEST_HOUSEHOLD_ID,
      year: 2024,
      month: 3,
      userId: USER_B,
      categoryId: preSavingCategoryId,
      budgetAmount: 20000,
      actualAmount: 20000,
    },
  });
  await prisma.weeklyBudget.create({
    data: {
      householdId: TEST_HOUSEHOLD_ID,
      year: 2024,
      month: 3,
      weekNo: 1,
      categoryId: variableCategoryId,
      budgetAmount: 5000,
    },
  });
});

beforeEach(async () => {
  // 各テストで対象データを変更しないため空実装（フィクスチャはbeforeAllで一括投入）
});

afterAll(async () => {
  await prisma.weeklyBudget.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.transaction.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.income.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.preSaving.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.category.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.user.deleteMany({ where: { id: { in: [USER_A, USER_B] } } });
  await prisma.household.deleteMany({ where: { id: TEST_HOUSEHOLD_ID } });
  await prisma.$disconnect();
});

describe('GET /api/v1/export', () => {
  it('Authorizationヘッダーがない場合は401', async () => {
    const res = await request(app).get('/api/v1/export?format=csv');
    expect(res.status).toBe(401);
  });

  it('formatが不正な場合は400', async () => {
    const res = await request(app)
      .get('/api/v1/export?format=pdf')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A));
    expect(res.status).toBe(400);
  });

  it('format=csvで取引一覧をCSV出力できる', async () => {
    const res = await request(app)
      .get('/api/v1/export?format=csv')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const body = res.text.replace(/^﻿/, '');
    const lines = body.trim().split('\r\n');
    expect(lines[0]).toBe('日付,費目,対象者,金額,メモ');
    expect(lines).toContain('2024-03-02,🍙食費,たいよう,500,コンビニ');
  });

  it('format=xlsxで全データをシート別に出力できる', async () => {
    // xlsxのMIMEタイプはsuperagentの標準パーサーがバイナリと認識しないため、
    // 生のバイト列をBufferとして受け取るカスタムパーサーを明示的に指定する
    const res = await request(app)
      .get('/api/v1/export?format=xlsx')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_A))
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');

    const wb = XLSX.read(res.body as Buffer, { type: 'buffer' });
    expect(wb.SheetNames).toEqual(['費目マスタ', '取引', '収入', '先取り貯金', '週次予算']);

    const transactionRows = XLSX.utils.sheet_to_json(wb.Sheets['取引'], { header: 1 }) as unknown[][];
    expect(transactionRows[0]).toEqual(['日付', '費目', '対象者', '金額', 'メモ']);
    expect(transactionRows[1]).toEqual(['2024-03-02', '🍙食費', 'たいよう', 500, 'コンビニ']);

    const incomeRows = XLSX.utils.sheet_to_json(wb.Sheets['収入'], { header: 1 }) as unknown[][];
    expect(incomeRows[1]).toEqual([2024, 3, 'たいよう', '給与', 300000]);

    const preSavingRows = XLSX.utils.sheet_to_json(wb.Sheets['先取り貯金'], { header: 1 }) as unknown[][];
    expect(preSavingRows[1]).toEqual([2024, 3, 'みらの', '📈積立NISA', 20000, 20000]);

    const weeklyBudgetRows = XLSX.utils.sheet_to_json(wb.Sheets['週次予算'], { header: 1 }) as unknown[][];
    expect(weeklyBudgetRows[1]).toEqual([2024, 3, 1, '🍙食費', 5000]);
  });

  it('他世帯のデータは出力されない', async () => {
    const otherHouseholdId = 999961n;
    await prisma.household.deleteMany({ where: { id: otherHouseholdId } });
    await prisma.household.create({ data: { id: otherHouseholdId } });

    const res = await request(app)
      .get('/api/v1/export?format=csv')
      .set('Authorization', authHeader(otherHouseholdId, USER_A));
    expect(res.status).toBe(200);
    const body = res.text.replace(/^﻿/, '');
    const lines = body.trim().split('\r\n');
    expect(lines).toHaveLength(1); // ヘッダー行のみ

    await prisma.household.deleteMany({ where: { id: otherHouseholdId } });
  });
});
