// docs/08_割り勘計算 仕様書.md 3章「精算ロジック（実装仕様）」のテスト。
// 3.1の疑似コードに厳密に従い、3.2の端数処理（取引ごとに丸めず、最終合計のみMath.round）を検証する。
import { describe, expect, it } from 'vitest';
import { calculateSettlement, SettlementMarkerTransaction } from '../src/services/settlementService';

const USER_A = 1n; // user_id昇順の先頭
const USER_B = 2n;

function tx(partial: Partial<SettlementMarkerTransaction>): SettlementMarkerTransaction {
  return {
    settlementPayerUserId: null,
    settlementBurden: null,
    settlementPartialAmount: null,
    amount: 0,
    ...partial,
  };
}

describe('calculateSettlement（3.1 汎用アルゴリズム・2人世帯前提）', () => {
  it('1. ☀のみ（折半・A払い）2件：Aが立て替えた分をBがAに支払う', () => {
    const result = calculateSettlement(
      [
        tx({ settlementPayerUserId: USER_A, settlementBurden: 'half', amount: 1000 }),
        tx({ settlementPayerUserId: USER_A, settlementBurden: 'half', amount: 2000 }),
      ],
      [USER_A, USER_B]
    );
    // A合計3000円立替、公平負担は各1500円 → Bが1500円不足＝Bが1500円支払う
    expect(result.direction).toBe('B_TO_A');
    expect(result.amount).toBe(1500);
  });

  it('2. ☆のみ（折半・B払い）2件：Bが立て替えた分をAがBに支払う', () => {
    const result = calculateSettlement(
      [
        tx({ settlementPayerUserId: USER_B, settlementBurden: 'half', amount: 800 }),
        tx({ settlementPayerUserId: USER_B, settlementBurden: 'half', amount: 1200 }),
      ],
      [USER_A, USER_B]
    );
    // B合計2000円立替、公平負担は各1000円 → Aが1000円不足＝Aが1000円支払う
    expect(result.direction).toBe('A_TO_B');
    expect(result.amount).toBe(1000);
  });

  it('3. ♠♡混在（全額相手負担）：相殺後の差額が精算される', () => {
    const result = calculateSettlement(
      [
        tx({ settlementPayerUserId: USER_B, settlementBurden: 'other_full', amount: 3000 }), // ♠：BがAの分を全額立替
        tx({ settlementPayerUserId: USER_A, settlementBurden: 'other_full', amount: 1000 }), // ♡：AがBの分を全額立替
      ],
      [USER_A, USER_B]
    );
    // Aの債務3000 - Aの債権1000 = 2000円をAがBに支払う
    expect(result.direction).toBe('A_TO_B');
    expect(result.amount).toBe(2000);
  });

  it('4. ☀☆♠♡ 4パターン全混在', () => {
    const result = calculateSettlement(
      [
        tx({ settlementPayerUserId: USER_A, settlementBurden: 'half', amount: 1000 }), // ☀
        tx({ settlementPayerUserId: USER_B, settlementBurden: 'half', amount: 1000 }), // ☆
        tx({ settlementPayerUserId: USER_B, settlementBurden: 'other_full', amount: 2000 }), // ♠
        tx({ settlementPayerUserId: USER_A, settlementBurden: 'other_full', amount: 1500 }), // ♡
      ],
      [USER_A, USER_B]
    );
    // -500 + 500 + 2000 - 1500 = 500円をAがBに支払う
    expect(result.direction).toBe('A_TO_B');
    expect(result.amount).toBe(500);
  });

  describe('5. 半端額(partial)ありのケース', () => {
    it('half・A払い・partialあり', () => {
      const result = calculateSettlement(
        [tx({ settlementPayerUserId: USER_A, settlementBurden: 'half', amount: 1000, settlementPartialAmount: 100 })],
        [USER_A, USER_B]
      );
      // share=500, fronted=1000-100=900 → netA=500-900=-400
      expect(result.direction).toBe('B_TO_A');
      expect(result.amount).toBe(400);
    });

    it('half・B払い・partialあり', () => {
      const result = calculateSettlement(
        [tx({ settlementPayerUserId: USER_B, settlementBurden: 'half', amount: 1000, settlementPartialAmount: 100 })],
        [USER_A, USER_B]
      );
      // share=500, partial=100 → netA=500-100=400
      expect(result.direction).toBe('A_TO_B');
      expect(result.amount).toBe(400);
    });

    it('other_full・B払い・partialあり', () => {
      const result = calculateSettlement(
        [tx({ settlementPayerUserId: USER_B, settlementBurden: 'other_full', amount: 800, settlementPartialAmount: 200 })],
        [USER_A, USER_B]
      );
      // fronted=800-200=600 → netA=+600
      expect(result.direction).toBe('A_TO_B');
      expect(result.amount).toBe(600);
    });

    it('other_full・A払い・partialあり', () => {
      const result = calculateSettlement(
        [tx({ settlementPayerUserId: USER_A, settlementBurden: 'other_full', amount: 800, settlementPartialAmount: 200 })],
        [USER_A, USER_B]
      );
      // fronted=800-200=600 → netA=-600
      expect(result.direction).toBe('B_TO_A');
      expect(result.amount).toBe(600);
    });
  });

  it('6. 金額が奇数円で端数が発生するケース：取引ごとに丸めず最終合計のみ丸める', () => {
    const result = calculateSettlement(
      [
        // share=500.5, fronted=1001 → -500.5
        tx({ settlementPayerUserId: USER_A, settlementBurden: 'half', amount: 1001 }),
        // share=0.5, fronted=1 → -0.5
        tx({ settlementPayerUserId: USER_A, settlementBurden: 'half', amount: 1 }),
      ],
      [USER_A, USER_B]
    );
    // 正しい実装: 合計-501.0円のみをMath.round → 501円
    // 誤った実装（取引ごとにMath.round）: round(-500.5)+round(-0.5) = -500+0 = -500円 になってしまう
    expect(result.direction).toBe('B_TO_A');
    expect(result.amount).toBe(501);
  });

  it('7. 対象取引0件 → NONE', () => {
    const result = calculateSettlement([], [USER_A, USER_B]);
    expect(result.direction).toBe('NONE');
    expect(result.amount).toBe(0);
  });

  it('8. netAがちょうど0 → NONE', () => {
    const result = calculateSettlement(
      [
        tx({ settlementPayerUserId: USER_A, settlementBurden: 'half', amount: 1000 }),
        tx({ settlementPayerUserId: USER_B, settlementBurden: 'half', amount: 1000 }),
      ],
      [USER_A, USER_B]
    );
    expect(result.direction).toBe('NONE');
    expect(result.amount).toBe(0);
  });

  it('settlementPayerUserIdがnullの行（精算対象外）は無視される', () => {
    const result = calculateSettlement(
      [
        tx({ settlementPayerUserId: null, settlementBurden: null, amount: 99999 }),
        tx({ settlementPayerUserId: USER_A, settlementBurden: 'half', amount: 1000 }),
      ],
      [USER_A, USER_B]
    );
    expect(result.direction).toBe('B_TO_A');
    expect(result.amount).toBe(500);
  });

  describe('実データ検算（現行Excelの数式から逆算した既知の正解値）', () => {
    // 各マーカー内の計算は amount/partial に対して線形（share=amount/2, fronted=amount-partial）なので、
    // 同一マーカー（同一payer×burden）の取引群はX合計・AA合計を1件の取引に集約しても結果は変わらない。
    function markerTx(
      payer: bigint,
      burden: 'half' | 'other_full',
      xTotal: number,
      aaTotal: number
    ): SettlementMarkerTransaction {
      return tx({ settlementPayerUserId: payer, settlementBurden: burden, amount: xTotal, settlementPartialAmount: aaTotal });
    }

    it('検算1：netA = 18250（A→B）', () => {
      const result = calculateSettlement(
        [
          markerTx(USER_A, 'half', 8795, 11091), // ☀
          markerTx(USER_B, 'half', 16887, 3873), // ☆
          markerTx(USER_B, 'other_full', 16268, 11310), // ♠
          markerTx(USER_A, 'other_full', 5845, 7873), // ♡
        ],
        [USER_A, USER_B]
      );
      expect(result.direction).toBe('A_TO_B');
      expect(result.amount).toBe(18250);
    });

    it('検算2：netA = -13912（B→A）', () => {
      const result = calculateSettlement(
        [
          markerTx(USER_A, 'half', 17050, 6260), // ☀
          markerTx(USER_B, 'half', 1262, 3368), // ☆
          markerTx(USER_B, 'other_full', 12899, 12616), // ♠
          markerTx(USER_A, 'other_full', 18328, 9135), // ♡
        ],
        [USER_A, USER_B]
      );
      expect(result.direction).toBe('B_TO_A');
      expect(result.amount).toBe(13912);
    });
  });
});
