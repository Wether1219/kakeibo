import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const TEST_HOUSEHOLD_ID = 999999n;
const OTHER_HOUSEHOLD_ID = 999998n;
const USER_ID = 999989n;
const OTHER_USER_ID = 999988n;
const app = createApp();

async function resetHousehold(id: bigint) {
  await prisma.auditLog.deleteMany({ where: { householdId: id } });
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
      { id: USER_ID, householdId: TEST_HOUSEHOLD_ID, displayName: 'たいよう' },
      { id: OTHER_USER_ID, householdId: OTHER_HOUSEHOLD_ID, displayName: 'みらの' },
    ],
  });
});

beforeEach(async () => {
  await prisma.category.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.category.deleteMany({ where: { householdId: OTHER_HOUSEHOLD_ID } });
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { householdId: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } } });
  await prisma.category.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.category.deleteMany({ where: { householdId: OTHER_HOUSEHOLD_ID } });
  await prisma.user.deleteMany({ where: { id: { in: [USER_ID, OTHER_USER_ID] } } });
  await prisma.household.deleteMany({ where: { id: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } } });
  await prisma.$disconnect();
});

describe('/api/v1/categories', () => {
  it('x-household-idヘッダーがない場合は401', async () => {
    const res = await request(app).get('/api/v1/categories');
    expect(res.status).toBe(401);
  });

  it('費目を追加して一覧取得できる', async () => {
    const createRes = await request(app)
      .post('/api/v1/categories')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_ID.toString())
      .send({ type: 'variable_expense', name: '食費', icon: '🍙' });
    expect(createRes.status).toBe(201);
    expect(createRes.body).toMatchObject({
      type: 'variable_expense',
      name: '食費',
      icon: '🍙',
      isActive: true,
    });

    const listRes = await request(app)
      .get('/api/v1/categories')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].name).toBe('食費');
  });

  it('typeで絞り込める', async () => {
    await request(app)
      .post('/api/v1/categories')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_ID.toString())
      .send({ type: 'variable_expense', name: '食費' });
    await request(app)
      .post('/api/v1/categories')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_ID.toString())
      .send({ type: 'income', name: '給与' });

    const res = await request(app)
      .get('/api/v1/categories?type=income')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].type).toBe('income');
  });

  it('同一世帯・同一区分・同一名は重複エラー(409)', async () => {
    await request(app)
      .post('/api/v1/categories')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_ID.toString())
      .send({ type: 'variable_expense', name: '食費' });
    const res = await request(app)
      .post('/api/v1/categories')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_ID.toString())
      .send({ type: 'variable_expense', name: '食費' });
    expect(res.status).toBe(409);
  });

  it('名前・アイコン・並び順を更新できる', async () => {
    const createRes = await request(app)
      .post('/api/v1/categories')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_ID.toString())
      .send({ type: 'fixed_expense', name: '家賃' });
    const id = createRes.body.id;

    const updateRes = await request(app)
      .put(`/api/v1/categories/${id}`)
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_ID.toString())
      .send({ name: '住居費', icon: '🏠', sortOrder: 3 });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body).toMatchObject({ name: '住居費', icon: '🏠', sortOrder: 3 });
  });

  it('他世帯の費目は更新・無効化できない(404)', async () => {
    const createRes = await request(app)
      .post('/api/v1/categories')
      .set('x-household-id', OTHER_HOUSEHOLD_ID.toString())
      .set('x-user-id', OTHER_USER_ID.toString())
      .send({ type: 'fixed_expense', name: '光熱費' });
    const id = createRes.body.id;

    const updateRes = await request(app)
      .put(`/api/v1/categories/${id}`)
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_ID.toString())
      .send({ name: '不正更新' });
    expect(updateRes.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/v1/categories/${id}`)
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_ID.toString());
    expect(deleteRes.status).toBe(404);
  });

  it('DELETEは論理削除でis_active=falseになり一覧から見えなくなる', async () => {
    const createRes = await request(app)
      .post('/api/v1/categories')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_ID.toString())
      .send({ type: 'variable_expense', name: '娯楽費' });
    const id = createRes.body.id;

    const deleteRes = await request(app)
      .delete(`/api/v1/categories/${id}`)
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_ID.toString());
    expect(deleteRes.status).toBe(204);

    const listRes = await request(app)
      .get('/api/v1/categories')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    const found = listRes.body.find((c: { id: string }) => c.id === id);
    expect(found.isActive).toBe(false);
  });
});
