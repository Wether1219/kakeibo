import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

const TEST_HOUSEHOLD_ID = 999949n;
const OTHER_HOUSEHOLD_ID = 999948n;
const USER_A = 999947n; // たいよう
const USER_B = 999946n; // みらの
const app = createApp();

const YEAR = 2027;

let assetAId: string;
let assetBId: string;

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
  await prisma.user.deleteMany({ where: { id: { in: [USER_A, USER_B] } } });
  await prisma.user.createMany({
    data: [
      { id: USER_A, householdId: TEST_HOUSEHOLD_ID, displayName: 'たいよう' },
      { id: USER_B, householdId: TEST_HOUSEHOLD_ID, displayName: 'みらの' },
    ],
  });
  const assetA = await prisma.asset.create({
    data: {
      householdId: TEST_HOUSEHOLD_ID,
      assetGroup: 'cash_deposit',
      name: '三井住友銀行',
      ownerUserId: USER_A,
    },
  });
  assetAId = assetA.id.toString();
  const assetB = await prisma.asset.create({
    data: {
      householdId: TEST_HOUSEHOLD_ID,
      assetGroup: 'cash_deposit',
      name: '三菱UFJ銀行',
      ownerUserId: USER_B,
    },
  });
  assetBId = assetB.id.toString();
});

beforeEach(async () => {
  await prisma.assetBalance.deleteMany({ where: { asset: { householdId: TEST_HOUSEHOLD_ID } } });
  await prisma.assetBalance.deleteMany({ where: { asset: { householdId: OTHER_HOUSEHOLD_ID } } });
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
  await prisma.user.deleteMany({ where: { id: { in: [USER_A, USER_B] } } });
  await prisma.household.deleteMany({ where: { id: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } } });
  await prisma.$disconnect();
});

describe('/api/v1/asset-balances', () => {
  it('x-household-idヘッダーがない場合は401', async () => {
    const res = await request(app).get(`/api/v1/asset-balances?year=${YEAR}`);
    expect(res.status).toBe(401);
  });

  it('yearがない場合は400', async () => {
    const res = await request(app)
      .get('/api/v1/asset-balances')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    expect(res.status).toBe(400);
  });

  it('一括登録して人別小計・合計付きで取得できる（更新も新規作成にならない）', async () => {
    const putRes = await request(app)
      .put('/api/v1/asset-balances/bulk')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_A.toString())
      .send([
        { assetId: assetAId, year: YEAR, month: 1, balance: 100000 },
        { assetId: assetBId, year: YEAR, month: 1, balance: 50000 },
      ]);
    expect(putRes.status).toBe(200);
    expect(putRes.body).toHaveLength(2);

    const updateRes = await request(app)
      .put('/api/v1/asset-balances/bulk')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_A.toString())
      .send([{ assetId: assetAId, year: YEAR, month: 1, balance: 120000 }]);
    expect(updateRes.body).toHaveLength(1);
    expect(updateRes.body[0].balance).toBe(120000);

    const getRes = await request(app)
      .get(`/api/v1/asset-balances?year=${YEAR}`)
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString());
    expect(getRes.status).toBe(200);

    const assetARow = getRes.body.assets.find((a: { assetId: string }) => a.assetId === assetAId);
    expect(assetARow.months[0]).toBe(120000);
    const assetBRow = getRes.body.assets.find((a: { assetId: string }) => a.assetId === assetBId);
    expect(assetBRow.months[0]).toBe(50000);

    const subtotalA = getRes.body.ownerSubtotals.find(
      (s: { ownerUserId: string }) => s.ownerUserId === USER_A.toString()
    );
    expect(subtotalA.months[0]).toBe(120000);
    const subtotalB = getRes.body.ownerSubtotals.find(
      (s: { ownerUserId: string }) => s.ownerUserId === USER_B.toString()
    );
    expect(subtotalB.months[0]).toBe(50000);

    expect(getRes.body.total[0]).toBe(170000);
    expect(getRes.body.total[1]).toBe(0);
  });

  it('assetIdが不正な場合は400', async () => {
    const res = await request(app)
      .put('/api/v1/asset-balances/bulk')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_A.toString())
      .send([{ assetId: '9999999', year: YEAR, month: 1, balance: 1000 }]);
    expect(res.status).toBe(400);
  });

  it('monthが範囲外（0または13）は400', async () => {
    const resZero = await request(app)
      .put('/api/v1/asset-balances/bulk')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_A.toString())
      .send([{ assetId: assetAId, year: YEAR, month: 0, balance: 1000 }]);
    expect(resZero.status).toBe(400);

    const resThirteen = await request(app)
      .put('/api/v1/asset-balances/bulk')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_A.toString())
      .send([{ assetId: assetAId, year: YEAR, month: 13, balance: 1000 }]);
    expect(resThirteen.status).toBe(400);
  });

  it('他世帯のassetIdは指定できない', async () => {
    const otherAsset = await prisma.asset.create({
      data: {
        householdId: OTHER_HOUSEHOLD_ID,
        assetGroup: 'cash_deposit',
        name: '他世帯銀行',
        ownerUserId: USER_A,
      },
    });
    const res = await request(app)
      .put('/api/v1/asset-balances/bulk')
      .set('x-household-id', TEST_HOUSEHOLD_ID.toString())
      .set('x-user-id', USER_A.toString())
      .send([{ assetId: otherAsset.id.toString(), year: YEAR, month: 1, balance: 1000 }]);
    expect(res.status).toBe(400);

    await prisma.asset.deleteMany({ where: { id: otherAsset.id } });
  });
});
