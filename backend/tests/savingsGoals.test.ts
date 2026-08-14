import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';
import { authHeader } from './helpers/auth';

const TEST_HOUSEHOLD_ID = 999889n;
const OTHER_HOUSEHOLD_ID = 999888n;
const USER_ID = 999887n;
const OTHER_USER_ID = 999886n;
const app = createApp();

async function resetHousehold(id: bigint) {
  await prisma.auditLog.deleteMany({ where: { householdId: id } });
  await prisma.savingsGoal.deleteMany({ where: { householdId: id } });
  await prisma.user.deleteMany({ where: { householdId: id } });
  await prisma.household.deleteMany({ where: { id } });
  await prisma.household.create({ data: { id } });
}

beforeAll(async () => {
  await resetHousehold(TEST_HOUSEHOLD_ID);
  await resetHousehold(OTHER_HOUSEHOLD_ID);
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
        id: OTHER_USER_ID,
        householdId: OTHER_HOUSEHOLD_ID,
        displayName: 'みらの',
        email: `user${OTHER_USER_ID}@test.local`,
        passwordHash: 'test-hash',
      },
    ],
  });
});

beforeEach(async () => {
  await prisma.savingsGoal.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
});

afterAll(async () => {
  await resetHousehold(TEST_HOUSEHOLD_ID);
  await resetHousehold(OTHER_HOUSEHOLD_ID);
  await prisma.household.deleteMany({ where: { id: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } } });
  await prisma.$disconnect();
});

describe('/api/v1/savings-goals', () => {
  it('Authorizationヘッダーがない場合は401', async () => {
    const res = await request(app).get('/api/v1/savings-goals');
    expect(res.status).toBe(401);
  });

  it('貯金目標を登録して一覧取得できる', async () => {
    const createRes = await request(app)
      .post('/api/v1/savings-goals')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send({ name: '旅行資金', targetAmount: 300000 });
    expect(createRes.status).toBe(201);
    expect(createRes.body).toMatchObject({ name: '旅行資金', targetAmount: 300000, isActive: true });

    const listRes = await request(app)
      .get('/api/v1/savings-goals')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
  });

  it('targetAmountが0以下は400', async () => {
    const res = await request(app)
      .post('/api/v1/savings-goals')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send({ name: '旅行資金', targetAmount: 0 });
    expect(res.status).toBe(400);
  });

  it('無効化した目標は一覧に表示されない', async () => {
    const createRes = await request(app)
      .post('/api/v1/savings-goals')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send({ name: '旅行資金', targetAmount: 300000 });
    const id = createRes.body.id;

    await request(app)
      .put(`/api/v1/savings-goals/${id}`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send({ isActive: false });

    const listRes = await request(app)
      .get('/api/v1/savings-goals')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(listRes.body).toHaveLength(0);
  });

  it('他世帯の貯金目標は更新できない(404)', async () => {
    const createRes = await request(app)
      .post('/api/v1/savings-goals')
      .set('Authorization', authHeader(OTHER_HOUSEHOLD_ID, OTHER_USER_ID))
      .send({ name: '車の頭金', targetAmount: 500000 });
    const id = createRes.body.id;

    const updateRes = await request(app)
      .put(`/api/v1/savings-goals/${id}`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send({ targetAmount: 1 });
    expect(updateRes.status).toBe(404);

    await prisma.savingsGoal.deleteMany({ where: { householdId: OTHER_HOUSEHOLD_ID } });
  });
});
