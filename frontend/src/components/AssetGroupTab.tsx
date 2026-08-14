import { AssetGroup } from '../api/assets';

export type AssetGroupTabValue = AssetGroup | 'net_worth';

interface Props {
  value: AssetGroupTabValue;
  onChange: (group: AssetGroupTabValue) => void;
}

const TABS: { group: AssetGroupTabValue; label: string }[] = [
  { group: 'cash_deposit', label: '現金・預貯金' },
  { group: 'securities', label: '証券・株式' },
  { group: 'insurance', label: '保険' },
  { group: 'net_worth', label: '純資産' },
];

export function AssetGroupTab({ value, onChange }: Props) {
  return (
    <div className="flex border-b border-gray-200 dark:border-gray-700">
      {TABS.map((tab) => (
        <button
          key={tab.group}
          type="button"
          className={`flex-1 py-2 text-sm font-medium border-b-2 ${
            value === tab.group
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
          onClick={() => onChange(tab.group)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
