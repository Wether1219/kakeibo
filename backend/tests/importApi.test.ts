import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';
import { authHeader } from './helpers/auth';

const FIXTURE_PATH = path.join(__dirname, 'fixtures', '雛形_家計簿_第1_4版.xlsm');

const TEST_HOUSEHOLD_ID = 999909n;
const USER_ID = 999908n;
const USER_ID_2 = 999905n;
const OTHER_HOUSEHOLD_ID = 999907n;
const OTHER_USER_ID = 999906n;
const OTHER_USER_ID_2 = 999904n;
const app = createApp();

async function resetHousehold(id: bigint) {
  await prisma.weeklyBudget.deleteMany({ where: { householdId: id } });
  await prisma.transaction.deleteMany({ where: { householdId: id } });
  await prisma.preSaving.deleteMany({ where: { householdId: id } });
  await prisma.income.deleteMany({ where: { householdId: id } });
  await prisma.category.deleteMany({ where: { householdId: id } });
  await prisma.user.deleteMany({ where: { householdId: id } });
  await prisma.household.deleteMany({ where: { id } });
  await prisma.household.create({ data: { id } });
}

beforeAll(async () => {
  // 雛形ファイルは「たいよう」「みらの」両方の人名で費目・収入等を参照するため、
  // 取込対象の世帯には両方のユーザーが必要。
  await resetHousehold(TEST_HOUSEHOLD_ID);
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
        id: USER_ID_2,
        householdId: TEST_HOUSEHOLD_ID,
        displayName: 'みらの',
        email: `user${USER_ID_2}@test.local`,
        passwordHash: 'test-hash',
      },
    ],
  });

  await resetHousehold(OTHER_HOUSEHOLD_ID);
  await prisma.user.createMany({
    data: [
      {
        id: OTHER_USER_ID,
        householdId: OTHER_HOUSEHOLD_ID,
        displayName: 'たいよう',
        email: `user${OTHER_USER_ID}@test.local`,
        passwordHash: 'test-hash',
      },
      {
        id: OTHER_USER_ID_2,
        householdId: OTHER_HOUSEHOLD_ID,
        displayName: 'みらの',
        email: `user${OTHER_USER_ID_2}@test.local`,
        passwordHash: 'test-hash',
      },
    ],
  });
});

afterAll(async () => {
  await resetHousehold(TEST_HOUSEHOLD_ID);
  await prisma.household.deleteMany({ where: { id: TEST_HOUSEHOLD_ID } });
  await resetHousehold(OTHER_HOUSEHOLD_ID);
  await prisma.household.deleteMany({ where: { id: OTHER_HOUSEHOLD_ID } });
  await prisma.$disconnect();
});

describe('POST /api/v1/import/excel', () => {
  it('Authorizationヘッダーがない場合は401', async () => {
    const res = await request(app)
      .post('/api/v1/import/excel')
      .attach('file', FIXTURE_PATH);
    expect(res.status).toBe(401);
  });

  it('fileがない場合は400', async () => {
    const res = await request(app)
      .post('/api/v1/import/excel')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(res.status).toBe(400);
  });

  it('雛形ファイルを取り込むと件数サマリが返り、認証済み世帯にデータが投入される', async () => {
    const res = await request(app)
      .post('/api/v1/import/excel')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .attach('file', FIXTURE_PATH);
    expect(res.status).toBe(200);
    expect(res.body.categories).toMatchObject({ createdCount: 24, updatedCount: 0 });
    expect(res.body.incomes.importedCount).toBe(120);
    expect(res.body.preSavings.importedCount).toBe(96);
    expect(res.body.weeklyBudgets.importedCount).toBe(480);

    const categoryCount = await prisma.category.count({ where: { householdId: TEST_HOUSEHOLD_ID } });
    expect(categoryCount).toBe(24);
  }, 30000);

  it('他世帯のユーザーではその世帯にのみ投入される（household分離）', async () => {
    const res = await request(app)
      .post('/api/v1/import/excel')
      .set('Authorization', authHeader(OTHER_HOUSEHOLD_ID, OTHER_USER_ID))
      .attach('file', FIXTURE_PATH);
    expect(res.status).toBe(200);

    const otherCategoryCount = await prisma.category.count({
      where: { householdId: OTHER_HOUSEHOLD_ID },
    });
    expect(otherCategoryCount).toBe(24);
  }, 30000);
});
