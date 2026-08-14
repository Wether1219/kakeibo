import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const TEST_HOUSEHOLD_ID = 999959n;
const OTHER_HOUSEHOLD_ID = 999958n;
const USER_A = 999957n; // たいよう
const USER_B = 999956n; // みらの
const OTHER_USER = 999955n; // 他世帯ユーザー
const app = createApp();

async function resetHousehold(id: bigint) {
  await prisma.assetBalance.deleteMany({ where: { asset: { householdId: id } } });
  await prisma.asset.deleteMany({ where: { householdId: id } });
  await prisma.auditLog.deleteMany({ where: { householdId: id } });
  await prisma.user.deleteMany({ where: { householdId: id } });
  await prisma.household.deleteMany({ where: { id } });
  await prisma.household.create({ data: { id } });
}

beforeAll(async () => {
  await resetHousehold(TEST_HOUSEHOLD_ID);
  await resetHousehold(OTHER_HOUSEHOLD_ID);
  await prisma.user.deleteMany({ where: { id: { in: [USER_A, USER_B, OTHER_USER] } } });
  await prisma.user.createMany({
    data: [
      { id: USER_A, householdId: TEST_HOUSEHOLD_ID, displayName: 'たいよう' },
      { id: USER_B, householdId: TEST_HOUSEHOLD_ID, displayName: 'みらの' },
      { id: OTHER_USER, householdId: OTHER_HOUSEHOLD_ID, displayName: '他世帯ユーザー' },
    ],
  });
});

beforeEach(async () => {
  await prisma.assetBalance.deleteMany({ where: { asset: { householdId: TEST_HOUSEHOLD_ID } } });
  await prisma.assetBalance.deleteMany({ where: { asset: { householdId: OTHER_HOUSEHOLD_ID } } });
  await prisma.asset.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.asset.deleteMany({ where: { householdId: OTHER_HOUSEHOLD_ID } });
});

afterAll(async () => {
  await prisma.assetBalance.deleteMany({
    where: { asset: { householdId: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } } },
  });
  await prisma.asset.deleteMany({
    where: { householdId: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } },
  });
  await prisma.auditLog.deleteMany({
    where: { householdId: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } },
  });
  await prisma.user.deleteMany({ where: { id: { in: [USER_A, USER_B, OTHER_USER] } } });
  await prisma.household.deleteMany({ where: { id: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } } });
  await prisma.$disconnect();
});

describe('/api/v1/assets', () => {
  it('x-household-idヘッダーがない場合は401', async () => {
    const res = await request(app).get('/api/v1/assets');
    expect(res.status).toBe(401);
  });

  it('口座を作成し一覧取得できる', async () => {
    const createRes = await request(app)
      .post('/api/v1/assets')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_A.toString())
      .send({
        assetGroup: 'cash_deposit',
        name: '三井住友銀行',
        detail: '普通',
        ownerUserId: USER_A.toString(),
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body).toMatchObject({
      assetGroup: 'cash_deposit',
      name: '三井住友銀行',
      detail: '普通',
      ownerUserId: USER_A.toString(),
      isActive: true,
    });

    const listRes = await request(app)
      .get('/api/v1/assets')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
  });

  it('assetGroupで絞り込める', async () => {
    await request(app)
      .post('/api/v1/assets')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_A.toString())
      .send({ assetGroup: 'cash_deposit', name: '銀行A', ownerUserId: USER_A.toString() });
    await request(app)
      .post('/api/v1/assets')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_A.toString())
      .send({ assetGroup: 'securities', name: '証券A', ownerUserId: USER_A.toString() });

    const res = await request(app)
      .get('/api/v1/assets?assetGroup=securities')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('証券A');
  });

  it('存在しないownerUserIdの場合は400', async () => {
    const res = await request(app)
      .post('/api/v1/assets')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_A.toString())
      .send({ assetGroup: 'cash_deposit', name: '銀行A', ownerUserId: '9999999' });
    expect(res.status).toBe(400);
  });

  it('口座を編集できる', async () => {
    const createRes = await request(app)
      .post('/api/v1/assets')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_A.toString())
      .send({ assetGroup: 'cash_deposit', name: '銀行A', ownerUserId: USER_A.toString() });

    const updateRes = await request(app)
      .put(`/api/v1/assets/${createRes.body.id}`)
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_A.toString())
      .send({ name: '銀行A（改称）', ownerUserId: USER_B.toString() });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body).toMatchObject({
      name: '銀行A（改称）',
      ownerUserId: USER_B.toString(),
    });
  });

  it('存在しないidの編集は404', async () => {
    const res = await request(app)
      .put('/api/v1/assets/9999999')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_A.toString())
      .send({ name: '銀行B' });
    expect(res.status).toBe(404);
  });

  it('他世帯の口座は一覧に表示されない', async () => {
    await request(app)
      .post('/api/v1/assets')
      .set('x-household-id', OTHER_HOUSEHOLD_ID.toString())
      .set('x-user-id', OTHER_USER.toString())
      .send({ assetGroup: 'cash_deposit', name: '他世帯銀行', ownerUserId: OTHER_USER.toString() });

    const res = await request(app)
      .get('/api/v1/assets')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});
