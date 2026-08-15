import type { SettlementBurden } from '../api/transactions';
import type { User } from '../api/users';

export interface SettlementFormValue {
  settlementPayerUserId: string | null;
  settlementBurden: SettlementBurden | null;
  settlementPartialAmount: number | null;
}

export const EMPTY_SETTLEMENT_FORM_VALUE: SettlementFormValue = {
  settlementPayerUserId: null,
  settlementBurden: null,
  settlementPartialAmount: null,
};

interface Props {
  value: SettlementFormValue;
  onChange: (value: SettlementFormValue) => void;
  users: User[];
  amount: number | '';
}

const BURDEN_OPTIONS: { key: SettlementBurden; label: string }[] = [
  { key: 'half', label: '折半' },
  { key: 'other_full', label: '全額相手負担' },
];

// docs/08_割り勘計算 仕様書.md 5.1・5.3節：SC03の割り勘設定セクション。
// デフォルトは「なし」（精算対象外）で折りたたみ、立替者を選択した場合のみ負担・半端額を表示する。
export function SettlementFormSection({ value, onChange, users, amount }: Props) {
  const partialAmountError =
    value.settlementPartialAmount !== null &&
    amount !== '' &&
    (value.settlementPartialAmount < 0 || value.settlementPartialAmount > amount)
      ? `半端額は0〜${amount}円の範囲で入力してください`
      : null;

  const handleSelectPayer = (userId: string | null) => {
    if (userId === null) {
      onChange(EMPTY_SETTLEMENT_FORM_VALUE);
      return;
    }
    onChange({
      settlementPayerUserId: userId,
      settlementBurden: value.settlementBurden ?? 'half',
      settlementPartialAmount: value.settlementPartialAmount,
    });
  };

  return (
    <details className="text-sm">
      <summary className="text-gray-500 dark:text-gray-400 cursor-pointer select-none">
        割り勘設定（任意）
      </summary>
      <div className="mt-2 space-y-3">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">立て替えた人</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleSelectPayer(null)}
              className={`py-2 rounded border text-sm font-bold ${
                value.settlementPayerUserId === null
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                  : 'border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              なし
            </button>
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => handleSelectPayer(u.id)}
                className={`py-2 rounded border text-sm font-bold truncate ${
                  value.settlementPayerUserId === u.id
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                    : 'border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                }`}
              >
                {u.displayName}
              </button>
            ))}
          </div>
        </div>

        {value.settlementPayerUserId !== null && (
          <>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">負担</label>
              <div className="grid grid-cols-2 gap-2">
                {BURDEN_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => onChange({ ...value, settlementBurden: opt.key })}
                    className={`py-2 rounded border text-sm font-bold ${
                      value.settlementBurden === opt.key
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                        : 'border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="settlement-partial-amount" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                相手がその場で払った額（任意）
              </label>
              <input
                id="settlement-partial-amount"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1"
                value={value.settlementPartialAmount ?? ''}
                placeholder="0"
                onChange={(e) =>
                  onChange({
                    ...value,
                    settlementPartialAmount: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                ※半端の現金を受け取った場合に入力
              </p>
              {partialAmountError && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{partialAmountError}</p>
              )}
            </div>
          </>
        )}
      </div>
    </details>
  );
}
