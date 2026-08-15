interface Props {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
}

export function DateRangeSelector({ startDate, endDate, onChange }: Props) {
  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      <input
        type="date"
        className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1.5 text-sm"
        value={startDate}
        onChange={(e) => onChange(e.target.value, endDate)}
        aria-label="開始日"
      />
      <span className="text-gray-500 dark:text-gray-400">〜</span>
      <input
        type="date"
        className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1.5 text-sm"
        value={endDate}
        onChange={(e) => onChange(startDate, e.target.value)}
        aria-label="終了日"
      />
    </div>
  );
}
