import { CategoryType } from '../api/summary';

export type SummaryTabType = CategoryType | 'savings_total';

interface Props {
  value: SummaryTabType;
  onChange: (type: SummaryTabType) => void;
}

const TABS: { type: SummaryTabType; label: string }[] = [
  { type: 'income', label: '収入' },
  { type: 'fixed_expense', label: '固定費' },
  { type: 'variable_expense', label: '変動費' },
  { type: 'pre_saving', label: '先取り貯金' },
  { type: 'savings_total', label: '貯金合計' },
];

export function CategoryTypeTab({ value, onChange }: Props) {
  return (
    <div className="flex border-b border-gray-200">
      {TABS.map((tab) => (
        <button
          key={tab.type}
          type="button"
          className={`flex-1 py-2 text-sm font-medium border-b-2 ${
            value === tab.type
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => onChange(tab.type)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
