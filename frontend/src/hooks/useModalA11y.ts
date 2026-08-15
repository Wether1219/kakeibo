import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

// モーダルの基本的なアクセシビリティ対応（初期フォーカス・Escape・フォーカストラップ）をまとめたフック。
// CategoryTypeSection.tsxのインライン編集セルのEscape処理と同じ考え方を、ダイアログ全体に拡張したもの。
// readyはデータ読込中でフォームが未描画の場合に初期フォーカスを遅らせるために使う。
export function useModalA11y(onClose: () => void, ready = true) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ready) return;
    const container = ref.current;
    if (!container) return;
    const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusables[0] ?? container).focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [onClose, ready]);

  return ref;
}
