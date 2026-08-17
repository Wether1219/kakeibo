import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';
import { authHeader } from './helpers/auth';

const TEST_HOUSEHOLD_ID = 999997n;
const OTHER_HOUSEHOLD_ID = 999996n;
const USER_ID = 999995n;
const OTHER_USER_ID = 999994n;
const SETTLEMENT_PARTNER_USER_ID = 999993n;
const app = createApp();

let categoryId: string;
const currentYear = new Date().getFullYear();

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
  await prisma.user.deleteMany({ where: { id: { in: [USER_ID, OTHER_USER_ID, SETTLEMENT_PARTNER_USER_ID] } } });
  await prisma.user.createMany({
    data: [
      { id: USER_ID, householdId: TEST_HOUSEHOLD_ID, displayName: 'たいよう', email: `user${USER_ID}@test.local`, passwordHash: 'test-hash' },
      { id: OTHER_USER_ID, householdId: OTHER_HOUSEHOLD_ID, displayName: 'みらの', email: `user${OTHER_USER_ID}@test.local`, passwordHash: 'test-hash' },
      { id: SETTLEMENT_PARTNER_USER_ID, householdId: TEST_HOUSEHOLD_ID, displayName: 'みらの', email: `user${SETTLEMENT_PARTNER_USER_ID}@test.local`, passwordHash: 'test-hash' },
    ],
  });
  const category = await prisma.category.create({
    data: { householdId: TEST_HOUSEHOLD_ID, type: 'variable_expense', name: '食費' },
  });
  categoryId = category.id.toString();
});

beforeEach(async () => {
  await prisma.transaction.deleteMany({ where: { householdId: TEST_HOUSEHOLD_ID } });
  await prisma.transaction.deleteMany({ where: { householdId: OTHER_HOUSEHOLD_ID } });
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { householdId: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } } });
  await prisma.transaction.deleteMany({
    where: { householdId: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } },
  });
  await prisma.category.deleteMany({ where: { householdId: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } } });
  await prisma.user.deleteMany({ where: { id: { in: [USER_ID, OTHER_USER_ID, SETTLEMENT_PARTNER_USER_ID] } } });
  await prisma.household.deleteMany({ where: { id: { in: [TEST_HOUSEHOLD_ID, OTHER_HOUSEHOLD_ID] } } });
  await prisma.$disconnect();
});

function baseBody(overrides: Record<string, unknown> = {}) {
  return {
    transactionDate: `${currentYear}-05-10`,
    categoryId,
    splitType: 'self',
    userId: USER_ID.toString(),
    amount: 1000,
    memo: 'ランチ',
    ...overrides,
  };
}

describe('/api/v1/transactions', () => {
  it('Authorizationヘッダーがない場合は401', async () => {
    const res = await request(app).get('/api/v1/transactions');
    expect(res.status).toBe(401);
  });

  it('Authorizationヘッダーがない場合、登録は401', async () => {
    const res = await request(app).post('/api/v1/transactions').send(baseBody());
    expect(res.status).toBe(401);
  });

  it('取引を登録して一覧取得できる', async () => {
    const createRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody());
    expect(createRes.status).toBe(201);
    expect(createRes.body).toMatchObject({
      categoryId,
      splitType: 'self',
      userId: USER_ID.toString(),
      amount: 1000,
      memo: 'ランチ',
      createdBy: USER_ID.toString(),
    });

    const listRes = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].amount).toBe(1000);
  });

  it('splitType=sharedの場合、userIdはNULLになる', async () => {
    const createRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ splitType: 'shared', userId: USER_ID.toString() }));
    expect(createRes.status).toBe(201);
    expect(createRes.body.splitType).toBe('shared');
    expect(createRes.body.userId).toBeNull();
  });

  it('splitType=selfでuserId未指定は400', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ splitType: 'self', userId: undefined }));
    expect(res.status).toBe(400);
  });

  it('金額が0以下は400', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ amount: 0 }));
    expect(res.status).toBe(400);
  });

  it('前後1年より古い日付は400', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ transactionDate: `${currentYear - 2}-05-10` }));
    expect(res.status).toBe(400);
  });

  it('前後1年より先の日付は400', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ transactionDate: `${currentYear + 2}-05-10` }));
    expect(res.status).toBe(400);
  });

  it('前年・翌年の日付は登録できる（年またぎの記帳漏れ対応）', async () => {
    const lastYearRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ transactionDate: `${currentYear - 1}-12-31` }));
    expect(lastYearRes.status).toBe(201);

    const nextYearRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ transactionDate: `${currentYear + 1}-01-01` }));
    expect(nextYearRes.status).toBe(201);
  });

  it('更新時も前後1年より古い日付は400', async () => {
    const createRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody());
    const updateRes = await request(app)
      .put(`/api/v1/transactions/${createRes.body.id}`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ transactionDate: `${currentYear - 2}-05-10` }));
    expect(updateRes.status).toBe(400);
  });

  it('year・monthで絞り込める', async () => {
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ transactionDate: `${currentYear}-05-10` }));
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ transactionDate: `${currentYear}-06-10` }));

    const res = await request(app)
      .get(`/api/v1/transactions?year=${currentYear}&month=5`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].transactionDate).toBe(`${currentYear}-05-10`);
  });

  it('limit・sort=date_descで件数制限と日付降順が反映される', async () => {
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ transactionDate: `${currentYear}-05-01` }));
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ transactionDate: `${currentYear}-05-20` }));
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ transactionDate: `${currentYear}-05-10` }));

    const res = await request(app)
      .get(`/api/v1/transactions?year=${currentYear}&month=5&limit=2&sort=date_desc`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].transactionDate).toBe(`${currentYear}-05-20`);
    expect(res.body[1].transactionDate).toBe(`${currentYear}-05-10`);
  });

  it('不正なsortは400', async () => {
    const res = await request(app)
      .get('/api/v1/transactions?sort=amount_asc')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(res.status).toBe(400);
  });

  it('不正なlimit（0以下）は400', async () => {
    const res = await request(app)
      .get('/api/v1/transactions?limit=0')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(res.status).toBe(400);
  });

  it(
    'limit未指定はデフォルト100件で打ち切られ、明示指定でも上限1000件で丸められる（X-Total-Countは実件数のまま）',
    async () => {
      const rows = Array.from({ length: 1005 }, (_, i) => ({
        householdId: TEST_HOUSEHOLD_ID,
        transactionDate: new Date(Date.UTC(currentYear, 4, 1)),
        categoryId: BigInt(categoryId),
        splitType: 'self' as const,
        userId: USER_ID,
        amount: 100 + (i % 900),
        createdBy: USER_ID,
      }));
      await prisma.transaction.createMany({ data: rows });

      const defaultRes = await request(app)
        .get('/api/v1/transactions')
        .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
      expect(defaultRes.status).toBe(200);
      expect(defaultRes.body).toHaveLength(100);
      expect(defaultRes.headers['x-total-count']).toBe('1005');

      const largeLimitRes = await request(app)
        .get('/api/v1/transactions?limit=5000')
        .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
      expect(largeLimitRes.status).toBe(200);
      expect(largeLimitRes.body).toHaveLength(1000);
    },
    20000
  );

  it('keywordでメモ・費目名を部分一致検索でき、X-Total-Countで全件数が返る', async () => {
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ memo: 'カフェでランチ' }));
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ memo: 'コンビニ' }));

    const memoRes = await request(app)
      .get('/api/v1/transactions?keyword=カフェ')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(memoRes.status).toBe(200);
    expect(memoRes.body).toHaveLength(1);
    expect(memoRes.body[0].memo).toBe('カフェでランチ');
    expect(memoRes.headers['x-total-count']).toBe('1');

    const categoryNameRes = await request(app)
      .get('/api/v1/transactions?keyword=食費')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(categoryNameRes.status).toBe(200);
    expect(categoryNameRes.body).toHaveLength(2);
    expect(categoryNameRes.headers['x-total-count']).toBe('2');
  });

  it('targetで対象者（共通/個人）を絞り込める', async () => {
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ splitType: 'self', userId: USER_ID.toString(), memo: '自分の分' }));
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(
        baseBody({
          splitType: 'self',
          userId: SETTLEMENT_PARTNER_USER_ID.toString(),
          memo: '相手の分',
        })
      );
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ splitType: 'shared', userId: USER_ID.toString(), memo: '共通の分' }));

    const sharedRes = await request(app)
      .get('/api/v1/transactions?target=shared')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(sharedRes.status).toBe(200);
    expect(sharedRes.body).toHaveLength(1);
    expect(sharedRes.body[0].memo).toBe('共通の分');
    expect(sharedRes.headers['x-total-count']).toBe('1');

    const userRes = await request(app)
      .get(`/api/v1/transactions?target=${USER_ID.toString()}`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(userRes.status).toBe(200);
    expect(userRes.body).toHaveLength(1);
    expect(userRes.body[0].memo).toBe('自分の分');
  });

  it('不正なtargetは400', async () => {
    const res = await request(app)
      .get('/api/v1/transactions?target=abc')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(res.status).toBe(400);
  });

  it('offsetでページネーションでき、X-Total-Countはoffset適用前の全件数を返す', async () => {
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ transactionDate: `${currentYear}-05-01` }));
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ transactionDate: `${currentYear}-05-10` }));
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ transactionDate: `${currentYear}-05-20` }));

    const res = await request(app)
      .get(`/api/v1/transactions?sort=date_desc&limit=1&offset=1`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].transactionDate).toBe(`${currentYear}-05-10`);
    expect(res.headers['x-total-count']).toBe('3');
  });

  it('不正なoffset（負の数）は400', async () => {
    const res = await request(app)
      .get('/api/v1/transactions?offset=-1')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(res.status).toBe(400);
  });

  it('取引を更新できる', async () => {
    const createRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody());
    const id = createRes.body.id;

    const updateRes = await request(app)
      .put(`/api/v1/transactions/${id}`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ amount: 2000, memo: '更新後' }));
    expect(updateRes.status).toBe(200);
    expect(updateRes.body).toMatchObject({ amount: 2000, memo: '更新後' });
  });

  it('他世帯の取引は更新・削除できない(404)', async () => {
    const otherCategory = await prisma.category.create({
      data: { householdId: OTHER_HOUSEHOLD_ID, type: 'variable_expense', name: '光熱費' },
    });
    const createRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(OTHER_HOUSEHOLD_ID, OTHER_USER_ID))
      .send(baseBody({ categoryId: otherCategory.id.toString() }));
    const id = createRes.body.id;

    const updateRes = await request(app)
      .put(`/api/v1/transactions/${id}`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody());
    expect(updateRes.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/v1/transactions/${id}`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(deleteRes.status).toBe(404);

    await prisma.transaction.deleteMany({ where: { householdId: OTHER_HOUSEHOLD_ID } });
    await prisma.category.delete({ where: { id: otherCategory.id } });
  });

  it('otherPaidAmountを指定して登録・更新でき、未指定時はnullになる', async () => {
    const createRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ splitType: 'shared', userId: undefined, amount: 4000, otherPaidAmount: 2000 }));
    expect(createRes.status).toBe(201);
    expect(createRes.body.otherPaidAmount).toBe(2000);

    const noneRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody());
    expect(noneRes.status).toBe(201);
    expect(noneRes.body.otherPaidAmount).toBeNull();

    const updateRes = await request(app)
      .put(`/api/v1/transactions/${createRes.body.id}`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ splitType: 'shared', userId: undefined, amount: 4000, otherPaidAmount: 1000 }));
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.otherPaidAmount).toBe(1000);
  });

  it('otherPaidAmountがamountを超える場合は400', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ amount: 1000, otherPaidAmount: 1001 }));
    expect(res.status).toBe(400);
  });

  it('otherPaidAmountが負数の場合は400', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ otherPaidAmount: -1 }));
    expect(res.status).toBe(400);
  });

  it('settlementPayerUserId・settlementBurden・settlementPartialAmountを指定して登録・更新でき、未指定時はnullになる', async () => {
    const createRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(
        baseBody({
          amount: 4000,
          settlementPayerUserId: SETTLEMENT_PARTNER_USER_ID.toString(),
          settlementBurden: 'half',
          settlementPartialAmount: 500,
        })
      );
    expect(createRes.status).toBe(201);
    expect(createRes.body.settlementPayerUserId).toBe(SETTLEMENT_PARTNER_USER_ID.toString());
    expect(createRes.body.settlementBurden).toBe('half');
    expect(createRes.body.settlementPartialAmount).toBe(500);

    const noneRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody());
    expect(noneRes.status).toBe(201);
    expect(noneRes.body.settlementPayerUserId).toBeNull();
    expect(noneRes.body.settlementBurden).toBeNull();
    expect(noneRes.body.settlementPartialAmount).toBeNull();

    const updateRes = await request(app)
      .put(`/api/v1/transactions/${createRes.body.id}`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(
        baseBody({
          amount: 4000,
          settlementPayerUserId: SETTLEMENT_PARTNER_USER_ID.toString(),
          settlementBurden: 'other_full',
          settlementPartialAmount: 0,
        })
      );
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.settlementBurden).toBe('other_full');
    expect(updateRes.body.settlementPartialAmount).toBe(0);
  });

  it('settlementPayerUserIdを指定してsettlementBurden未指定の場合は400', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ settlementPayerUserId: SETTLEMENT_PARTNER_USER_ID.toString() }));
    expect(res.status).toBe(400);
  });

  it('settlementBurdenを指定してsettlementPayerUserId未指定の場合は400', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ settlementBurden: 'half' }));
    expect(res.status).toBe(400);
  });

  it('settlementPartialAmountがamountを超える場合は400', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(
        baseBody({
          amount: 1000,
          settlementPayerUserId: SETTLEMENT_PARTNER_USER_ID.toString(),
          settlementBurden: 'half',
          settlementPartialAmount: 1001,
        })
      );
    expect(res.status).toBe(400);
  });

  it('settlementPartialAmountが負数の場合は400', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(
        baseBody({
          settlementPayerUserId: SETTLEMENT_PARTNER_USER_ID.toString(),
          settlementBurden: 'half',
          settlementPartialAmount: -1,
        })
      );
    expect(res.status).toBe(400);
  });

  it('settlementBurdenが不正な値の場合は400', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody({ settlementPayerUserId: SETTLEMENT_PARTNER_USER_ID.toString(), settlementBurden: 'invalid' }));
    expect(res.status).toBe(400);
  });

  it('取引を削除できる', async () => {
    const createRes = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
      .send(baseBody());
    const id = createRes.body.id;

    const deleteRes = await request(app)
      .delete(`/api/v1/transactions/${id}`)
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(deleteRes.status).toBe(204);

    const listRes = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
    expect(listRes.body).toHaveLength(0);
  });

  describe('POST /transactions/restore/:auditLogId', () => {
    it('削除済み取引を監査ログから復元でき、復元操作自体も新規createログとして記録される', async () => {
      const createRes = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
        .send(baseBody({ memo: '復元テスト' }));
      const id = createRes.body.id;

      await request(app)
        .delete(`/api/v1/transactions/${id}`)
        .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));

      const deleteLog = await prisma.auditLog.findFirst({
        where: {
          householdId: TEST_HOUSEHOLD_ID,
          targetTable: 'transactions',
          action: 'delete',
          targetId: BigInt(id),
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(deleteLog).not.toBeNull();

      const restoreRes = await request(app)
        .post(`/api/v1/transactions/restore/${deleteLog!.id}`)
        .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
      expect(restoreRes.status).toBe(201);
      expect(restoreRes.body).toMatchObject({ memo: '復元テスト', amount: 1000 });
      expect(restoreRes.body.id).not.toBe(id);

      const listRes = await request(app)
        .get('/api/v1/transactions')
        .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
      expect(listRes.body).toHaveLength(1);

      const createLog = await prisma.auditLog.findFirst({
        where: {
          householdId: TEST_HOUSEHOLD_ID,
          targetTable: 'transactions',
          action: 'create',
          targetId: BigInt(restoreRes.body.id),
        },
      });
      expect(createLog).not.toBeNull();
      expect((createLog!.diffJson as { restoredFromAuditLogId?: string }).restoredFromAuditLogId).toBe(
        String(deleteLog!.id)
      );
    });

    it('他世帯の削除履歴からは復元できない(404)', async () => {
      const otherCategory = await prisma.category.create({
        data: { householdId: OTHER_HOUSEHOLD_ID, type: 'variable_expense', name: '光熱費' },
      });
      const createRes = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', authHeader(OTHER_HOUSEHOLD_ID, OTHER_USER_ID))
        .send(baseBody({ categoryId: otherCategory.id.toString() }));
      const id = createRes.body.id;
      await request(app)
        .delete(`/api/v1/transactions/${id}`)
        .set('Authorization', authHeader(OTHER_HOUSEHOLD_ID, OTHER_USER_ID));

      const deleteLog = await prisma.auditLog.findFirst({
        where: {
          householdId: OTHER_HOUSEHOLD_ID,
          targetTable: 'transactions',
          action: 'delete',
          targetId: BigInt(id),
        },
        orderBy: { createdAt: 'desc' },
      });

      const res = await request(app)
        .post(`/api/v1/transactions/restore/${deleteLog!.id}`)
        .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
      expect(res.status).toBe(404);
    });

    it('存在しない削除履歴IDを指定した場合は404', async () => {
      const res = await request(app)
        .post('/api/v1/transactions/restore/999999999999')
        .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
      expect(res.status).toBe(404);
    });

    it('削除以外の監査ログID（作成ログ等）を指定した場合は404', async () => {
      const createRes = await request(app)
        .post('/api/v1/transactions')
        .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID))
        .send(baseBody());
      const createLog = await prisma.auditLog.findFirst({
        where: {
          householdId: TEST_HOUSEHOLD_ID,
          targetTable: 'transactions',
          action: 'create',
          targetId: BigInt(createRes.body.id),
        },
        orderBy: { createdAt: 'desc' },
      });

      const res = await request(app)
        .post(`/api/v1/transactions/restore/${createLog!.id}`)
        .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
      expect(res.status).toBe(404);
    });

    it('A1の前後1年チェックの対象外（それより古い）削除済み取引も復元できる', async () => {
      const oldDate = `${currentYear - 3}-01-15`;
      const auditLog = await prisma.auditLog.create({
        data: {
          householdId: TEST_HOUSEHOLD_ID,
          userId: USER_ID,
          targetTable: 'transactions',
          targetId: 1n,
          action: 'delete',
          diffJson: {
            before: {
              transactionDate: oldDate,
              categoryId,
              splitType: 'self',
              userId: USER_ID.toString(),
              amount: 500,
              memo: '古いデータ',
              otherPaidAmount: null,
              settlementPayerUserId: null,
              settlementBurden: null,
              settlementPartialAmount: null,
              createdBy: USER_ID.toString(),
            },
          },
        },
      });

      const res = await request(app)
        .post(`/api/v1/transactions/restore/${auditLog.id}`)
        .set('Authorization', authHeader(TEST_HOUSEHOLD_ID, USER_ID));
      expect(res.status).toBe(201);
      expect(res.body.transactionDate).toBe(oldDate);
    });
  });
});
