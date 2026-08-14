import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';
import { authHeader } from './helpers/auth';

const TEST_HOUSEHOLD_ID = 999979n;
const OTHER_HOUSEHOLD_ID = 999978n;
const USER_ID = 999977n;
const OTHER_USER_ID = 999976n;
const app = createApp();

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
  await prisma.user.deleteMany({ where: { id: { in: [USER_ID, OTHER_USER_ID] } } });
  await prisma.user.createMany({
    data: [
      { id: USER_ID, householdId: TEST_HOUSEHOLD_ID, displayName: 'たいよう', email: `user${USER_ID}@test.local`, passwordHash: 'test-hash' },
      { id: OTHER_USER_ID, householdId: OTHER_HOUSEHOLD_ID, displayName: 'みらの', email: `user${OTHER_USER_ID}@test.local`, passwordHash: 'test-hash' },
    ],
  });
});

beforeEach(async () => {
  await prisma.auditLog.deleteMany({ where: { householdId: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } } });
  await prisma.transaction.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.category.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  const category = await prisma.category.create({
    data: { householdId: TEST_HOUSEHOLD_ID, type: 'variable_expense', name: '食費' },
  });
  categoryId = category.id.toString();
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { householdId: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } } });
  await prisma.transaction.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.category.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.user.deleteMany({ where: { id: { in: [USER_ID, OTHER_USER_ID] } } });
  await prisma.household.deleteMany({ where: { id: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } } });
  await prisma.$disconnect();
});

describe('/api/v1/audit-logs', () => {
  it('Authorizationヘッダーがない場合は401', async () => {
    const res = await request(app).get('/api/v1/audit-logs');
    expect(res.status).toBe(401);
  });

  it('費目の作成・更新・無効化がそれぞれcreate/update/deleteとして記録される', async () => {
    const createRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send({ type: 'variable_expense', name: '娯楽費' });
    const id = createRes.body.id;

    await request(app)
      .put(`/api/v1/categories/${id}`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send({ name: '趣味費' });

    await request(app)
      .delete(`/api/v1/categories/${id}`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));

    const res = await request(app)
      .get('/api/v1/audit-logs?targetTable=categories')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);

    // created_at降順（新しい順）
    expect(res.body.map((log: { action: string }) => log.action)).toEqual(['delete', 'update', 'create']);
    for (const log of res.body) {
      expect(log.targetId).toBe(id);
      expect(log.userId).toBe(USER_ID.toString());
    }

    const updateLog = res.body.find((log: { action: string }) => log.action === 'update');
    expect(updateLog.diff.before.name).toBe('娯楽費');
    expect(updateLog.diff.after.name).toBe('趣味費');
  });

  it('取引の登録・更新・削除が記録される', async () => {
    const currentYear = new Date().getFullYear();
    const createRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send({
        transactionDate: `${currentYear}-05-10`,
        categoryId,
        splitType: 'self',
        userId: USER_ID.toString(),
        amount: 1000,
      });
    const id = createRes.body.id;

    await request(app)
      .delete(`/api/v1/transactions/${id}`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));

    const res = await request(app)
      .get('/api/v1/audit-logs?targetTable=transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((log: { action: string }) => log.action)).toEqual(['delete', 'create']);
    expect(res.body[0].diff.before.amount).toBe(1000);
  });

  it('limitで件数を絞り込める', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/v1/categories')
        .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
        .send({ type: 'variable_expense', name: `費目${i}` });
    }
    const res = await request(app)
      .get('/api/v1/audit-logs?limit=2')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('他世帯の変更履歴は取得できない', async () => {
    const otherCategory = await prisma.category.create({
      data: { householdId: OTHER_HOUSEHOLD_ID, type: 'variable_expense', name: '光熱費' },
    });
    await request(app)
      .put(`/api/v1/categories/${otherCategory.id}`)
      .set('Authorization', authHeader(OTHER_HOUSEHOLD_ID, OTHER_USER_ID))
      .send({ name: '水道光熱費' });

    const res = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);

    await prisma.category.deleteMany({ where: { householdId: OTHER_HOUSEHOLD_ID } });
  });
});
