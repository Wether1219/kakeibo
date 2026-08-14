import { AssetGroup } from '../api/assets';

interface Props {
  value: AssetGroup;
  onChange: (group: AssetGroup) => void;
}

const TABS: { group: AssetGroup; label: string }[] = [
  { group: 'cash_deposit', label: '現金・預貯金' },
  { group: 'securities', label: '証券・株式' },
  { group: 'insurance', label: '保険' },
];

export function AssetGroupTab({ value, onChange }: Props) {
  return (
    <div className="flex border-b border-gray-200">
      {TABS.map((tab) => (
        <button
          key={tab.group}
          type="button"
          className={`flex-1 py-2 text-sm font-medium border-b-2 ${
            value === tab.group
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => onChange(tab.group)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
