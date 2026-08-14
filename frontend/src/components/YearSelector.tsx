interface Props {
  year: number;
  onChange: (year: number) => void;
}

export function YearSelector({ year, onChange }: Props) {
  return (
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        className="px-3 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
        onClick={() => onChange(year - 1)}
        aria-label="前年"
      >
        ◀
      </button>
      <span className="text-lg font-bold min-w-[6rem] text-center">{year}年</span>
      <button
        type="button"
        className="px-3 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
        onClick={() => onChange(year + 1)}
        aria-label="翌年"
      >
        ▶
      </button>
    </div>
  );
}
