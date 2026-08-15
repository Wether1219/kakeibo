import { useSearchParams } from 'react-router-dom';

// 精算画面（Settlement）向け。開始日・終了日をURLクエリパラメータ(?startDate=&endDate=)として共有するためのフック。
// year(・month)前提のuseYearMonthParamsとは責務が異なるため別ファイルとしている。
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function isValidISODate(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

export function useDateRangeParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const startParam = searchParams.get('startDate');
  const endParam = searchParams.get('endDate');
  const startDate = isValidISODate(startParam) ? startParam : `${today().slice(0, 7)}-01`;
  const endDate = isValidISODate(endParam) ? endParam : today();

  const setDateRange = (nextStart: string, nextEnd: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('startDate', nextStart);
        next.set('endDate', nextEnd);
        return next;
      },
      { replace: true }
    );
  };

  return { startDate, endDate, setDateRange };
}
