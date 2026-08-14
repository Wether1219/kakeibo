import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';
import { verifyAuthToken } from '../src/services/authService';

const TEST_HOUSEHOLD_ID = 999945n;
const USER_ID = 999944n;
const TEST_EMAIL = 'auth-test-user@test.local';
const TEST_PASSWORD = 'correct-password';

const app = createApp();

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { id: USER_ID } });
  await prisma.household.deleteMany({ where: { id: TEST_HOUSEHOLD_ID } });
  await prisma.household.create({ data: { id: TEST_HOUSEHOLD_ID } });
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  await prisma.user.create({
    data: {
      id: USER_ID,
      householdId: TEST_HOUSEHOLD_ID,
      displayName: 'たいよう',
      email: TEST_EMAIL,
      passwordHash,
      colorCode: '#4A90D9',
    },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: USER_ID } });
  await prisma.household.deleteMany({ where: { id: TEST_HOUSEHOLD_ID } });
  await prisma.$disconnect();
});

describe('POST /api/v1/auth/login', () => {
  it('正しいemail・passwordでログインするとaccessTokenとuserを返す', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.user).toMatchObject({
      id: USER_ID.toString(),
      householdId: TEST_HOUSEHOLD_ID.toString(),
      email: TEST_EMAIL,
      displayName: 'たいよう',
      colorCode: '#4A90D9',
    });
    // password_hashがレスポンスに含まれないこと
    expect(res.body.user.passwordHash).toBeUndefined();

    const payload = verifyAuthToken(res.body.accessToken);
    expect(payload.householdId).toBe(TEST_HOUSEHOLD_ID.toString());
    expect(payload.userId).toBe(USER_ID.toString());
  });

  it('発行されたトークンで他のAPIにアクセスできる', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    const token = loginRes.body.accessToken as string;

    const res = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('パスワードが間違っている場合は401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('存在しないemailの場合は401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@test.local', password: TEST_PASSWORD });
    expect(res.status).toBe(401);
  });

  it('emailまたはpasswordが未指定の場合は400', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: TEST_EMAIL });
    expect(res.status).toBe(400);
  });
});

describe('認証が必要なAPIへの不正アクセス', () => {
  it('Authorizationヘッダーがない場合は401', async () => {
    const res = await request(app).get('/api/v1/categories');
    expect(res.status).toBe(401);
  });

  it('不正なトークンの場合は401', async () => {
    const res = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
  });
});
