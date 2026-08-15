import { useEffect, useMemo, useState } from 'react';
import { AnnualCrossTable } from '../components/AnnualCrossTable';
import { CategoryTypeTab, SummaryTabType } from '../components/CategoryTypeTab';
import { LineChart } from '../components/charts/LineChart';
import {
  calculateMonthlyTotalSaving,
  getUsersFromRows,
  MonthlySavingsSummary,
} from '../components/MonthlySavingsSummary';
import { YearSelector } from '../components/YearSelector';
import { useAnnualSummary } from '../hooks/useAnnualSummary';
import { useYearParam } from '../hooks/useYearMonthParams';
import { ErrorMessage, LoadingMessage } from '../components/StatusMessage';

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const SERIES_COLORS = ['#4C6EF5', '#F76707', '#12B886', '#E64980'];
const TOTAL_OPTION = '__total__';
const TOTAL_OPTION_TABS: SummaryTabType[] = ['income', 'fixed_expense', 'variable_expense', 'pre_saving'];

function sumMonths(rowsList: { months: number[] }[]): number[] {
  const totals = new Array(12).fill(0);
  for (const row of rowsList) {
    row.months.forEach((amount, i) => {
      totals[i] += amount;
    });
  }
  return totals;
}

export function SC07_AnnualTrend() {
  const [year, setYear] = useYearParam();
  const [tab, setTab] = useState<SummaryTabType>('variable_expense');
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>('');
  const [checkedUserIds, setCheckedUserIds] = useState<Set<string>>(new Set());

  const { rows, loading, error } = useAnnualSummary(year);
  const isSavingsTotal = tab === 'savings_total';

  const filteredRows = useMemo(
    () => (isSavingsTotal ? [] : rows.filter((r) => r.categoryType === tab)),
    [rows, tab, isSavingsTotal]
  );

  const showTotalOption = TOTAL_OPTION_TABS.includes(tab);

  const categoryNames = useMemo(() => {
    const names = Array.from(new Set(filteredRows.map((r) => r.categoryName)));
    return showTotalOption ? [TOTAL_OPTION, ...names] : names;
  }, [filteredRows, showTotalOption]);

  const users = useMemo(() => getUsersFromRows(rows), [rows]);

  useEffect(() => {
    if (categoryNames.length > 0 && !categoryNames.includes(selectedCategoryName)) {
      setSelectedCategoryName(categoryNames[0]);
    }
    if (categoryNames.length === 0) {
      setSelectedCategoryName('');
    }
  }, [categoryNames, selectedCategoryName]);

  useEffect(() => {
    setCheckedUserIds(new Set(users.map((u) => u.userId)));
  }, [users]);

  const handleToggleUser = (userId: string) => {
    setCheckedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const datasets = useMemo(() => {
    return users
      .filter((u) => checkedUserIds.has(u.userId))
      .map((u, i) => {
        const color = SERIES_COLORS[i % SERIES_COLORS.length];
        const userRows = filteredRows.filter((r) => r.userId === u.userId);
        const data = isSavingsTotal
          ? calculateMonthlyTotalSaving(rows, u.userId)
          : selectedCategoryName === TOTAL_OPTION
            ? sumMonths(userRows)
            : userRows.find((r) => r.categoryName === selectedCategoryName)?.months ??
              new Array(12).fill(0);
        return {
          label: u.displayName,
          data,
          borderColor: color,
          backgroundColor: color,
        };
      });
  }, [users, checkedUserIds, filteredRows, selectedCategoryName, isSavingsTotal, rows]);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <YearSelector year={year} onChange={setYear} />

      <CategoryTypeTab value={tab} onChange={setTab} />

      {loading && <LoadingMessage />}
      {error && <ErrorMessage>{error}</ErrorMessage>}

      {!loading && !error && (
        <>
          {isSavingsTotal ? (
            <MonthlySavingsSummary rows={rows} />
          ) : (
            <AnnualCrossTable rows={filteredRows} />
          )}

          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-4">
              {!isSavingsTotal && (
                <select
                  className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1 text-sm"
                  value={selectedCategoryName}
                  onChange={(e) => setSelectedCategoryName(e.target.value)}
                >
                  {categoryNames.map((name) => (
                    <option key={name} value={name}>
                      {name === TOTAL_OPTION ? '合計（全費目）' : name}
                    </option>
                  ))}
                </select>
              )}
              {users.map((u) => (
                <label key={u.userId} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={checkedUserIds.has(u.userId)}
                    onChange={() => handleToggleUser(u.userId)}
                  />
                  {u.displayName}
                </label>
              ))}
            </div>
            <div className="h-64">
              <LineChart labels={MONTH_LABELS} datasets={datasets} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
