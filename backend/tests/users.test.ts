import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';
import { authHeader } from './helpers/auth';

const TEST_HOUSEHOLD_ID = 999985n;
const OTHER_HOUSEHOLD_ID = 999984n;
const USER_ID = 999983n;
const OTHER_USER_ID = 999982n;
const app = createApp();

async function resetHousehold(id: bigint) {
  await prisma.household.deleteMany({ where: { id } });
  await prisma.household.create({ data: { id } });
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [USER_ID, OTHER_USER_ID] } } });
  await resetHousehold(TEST_HOUSEHOLD_ID);
  await resetHousehold(OTHER_HOUSEHOLD_ID);
  await prisma.user.createMany({
    data: [
      { id: USER_ID, householdId: TEST_HOUSEHOLD_ID, displayName: 'たいよう', email: `user${USER_ID}@test.local`, passwordHash: 'test-hash' },
      { id: OTHER_USER_ID, householdId: OTHER_HOUSEHOLD_ID, displayName: 'みらの', email: `user${OTHER_USER_ID}@test.local`, passwordHash: 'test-hash' },
    ],
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [USER_ID, OTHER_USER_ID] } } });
  await prisma.household.deleteMany({ where: { id: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } } });
  await prisma.$disconnect();
});

describe('/api/v1/users', () => {
  it('Authorizationヘッダーがない場合は401', async () => {
    const res = await request(app).get('/api/v1/users');
    expect(res.status).toBe(401);
  });

  it('自世帯のユーザーのみ一覧取得できる', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: USER_ID.toString(), displayName: 'たいよう' });
  });
});
