import { useState } from 'react';
import { CATEGORY_ICON_OPTIONS } from '../constants/categoryIcons';
import { useModalA11y } from '../hooks/useModalA11y';

interface Props {
  value: string;
  onChange: (icon: string) => void;
}

// 費目アイコンの選択式ピッカー。ボタンをタップすると候補の絵文字グリッドを表示し、
// 一覧にない絵文字は下部の自由入力欄からも設定できる。
export function IconPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const dialogRef = useModalA11y(() => setOpen(false), open);

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
        className="w-10 h-8 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded text-center hover:bg-gray-50 dark:hover:bg-gray-700"
        onClick={() => setOpen((o) => !o)}
        aria-label="アイコンを選択"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {value || '？'}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            ref={dialogRef}
            tabIndex={-1}
            role="group"
            aria-label="アイコン候補"
            className="absolute z-20 mt-1 w-60 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg p-2"
          >
            <div className="grid grid-cols-7 gap-1 max-h-40 overflow-y-auto">
              {CATEGORY_ICON_OPTIONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  aria-pressed={value === icon}
                  className={`text-lg rounded py-1 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    value === icon ? 'bg-blue-50 dark:bg-blue-950 ring-1 ring-blue-400' : ''
                  }`}
                  onClick={() => select(icon)}
                >
                  {icon}
                </button>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center gap-1">
              <input
                aria-label="アイコンを自由入力"
                className="w-16 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-1 py-0.5 text-center text-sm"
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
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline px-1"
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
