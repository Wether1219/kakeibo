import { useState } from 'react';
import { CATEGORY_ICON_OPTIONS } from '../constants/categoryIcons';

interface Props {
  value: string;
  onChange: (icon: string) => void;
}

// 費目アイコンの選択式ピッカー。ボタンをタップすると候補の絵文字グリッドを表示し、
// 一覧にない絵文字は下部の自由入力欄からも設定できる。
export function IconPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');

  const select = (icon: string) => {
    onChange(icon);
    setOpen(false);
  };

  const submitCustom = () => {
    if (custom.trim()) {
      onChange(custom.trim());
      setCustom('');
      setOpen(false);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        className="w-10 h-8 border border-gray-300 rounded text-center hover:bg-gray-50"
        onClick={() => setOpen((o) => !o)}
        aria-label="アイコンを選択"
      >
        {value || '？'}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-60 bg-white border border-gray-200 rounded shadow-lg p-2">
            <div className="grid grid-cols-7 gap-1 max-h-40 overflow-y-auto">
              {CATEGORY_ICON_OPTIONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  className={`text-lg rounded py-1 hover:bg-gray-100 ${
                    value === icon ? 'bg-blue-50 ring-1 ring-blue-400' : ''
                  }`}
                  onClick={() => select(icon)}
                >
                  {icon}
                </button>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1">
              <input
                className="w-16 border border-gray-300 rounded px-1 py-0.5 text-center text-sm"
                placeholder="自由入力"
                value={custom}
                maxLength={4}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitCustom();
                  }
                }}
              />
              <button
                type="button"
                className="text-xs text-blue-600 hover:underline px-1"
                onClick={submitCustom}
              >
                決定
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
