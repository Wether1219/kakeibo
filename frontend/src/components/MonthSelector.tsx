interface Props {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}

export function MonthSelector({ year, month, onChange }: Props) {
  const handlePrev = () => {
    if (month === 1) {
      onChange(year - 1, 12);
    } else {
      onChange(year, month - 1);
    }
  };

  const handleNext = () => {
    if (month === 12) {
      onChange(year + 1, 1);
    } else {
      onChange(year, month + 1);
    }
  };

  return (
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        className="px-3 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
        onClick={handlePrev}
        aria-label="前月"
      >
        ◀
      </button>
      <span className="text-lg font-bold min-w-[7rem] text-center">
        {year}年{month}月
      </span>
      <button
        type="button"
        className="px-3 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
        onClick={handleNext}
        aria-label="翌月"
      >
        ▶
      </button>
    </div>
  );
}
