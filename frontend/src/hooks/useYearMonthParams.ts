import { useSearchParams } from 'react-router-dom';

// SC02(ダッシュボード)・SC07(年間推移)・SC08(収支可視化)・SC09(資産管理)で
// 年(・月)の選択状態をURLクエリパラメータ(?year=&month=)として共有するためのフック。
// 画面遷移時はNavBar側がクエリパラメータを引き継いでリンクするため選択状態が保持され、
// リロード・直リンクでも同じ年月が復元される。
const now = new Date();

export function useYearParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const yearParam = Number(searchParams.get('year'));
  const year = Number.isInteger(yearParam) && yearParam > 0 ? yearParam : now.getFullYear();

  const setYear = (nextYear: number) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('year', String(nextYear));
        return next;
      },
      { replace: true }
    );
  };

  return [year, setYear] as const;
}

export function useYearMonthParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const yearParam = Number(searchParams.get('year'));
  const monthParam = Number(searchParams.get('month'));
  const year = Number.isInteger(yearParam) && yearParam > 0 ? yearParam : now.getFullYear();
  const month =
    Number.isInteger(monthParam) && monthParam >= 1 && monthParam <= 12
      ? monthParam
      : now.getMonth() + 1;

  const setYearMonth = (nextYear: number, nextMonth: number) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('year', String(nextYear));
        next.set('month', String(nextMonth));
        return next;
      },
      { replace: true }
    );
  };

  return { year, month, setYearMonth };
}
