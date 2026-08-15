import { useMemo, useState } from 'react';
import { AssetGroup, deactivateAsset } from '../api/assets';
import { AddAssetModal } from '../components/AddAssetModal';
import { AssetBalanceTable } from '../components/AssetBalanceTable';
import { AssetGroupTab, AssetGroupTabValue } from '../components/AssetGroupTab';
import { LineChart } from '../components/charts/LineChart';
import { NetWorthSummary } from '../components/NetWorthSummary';
import { ErrorMessage, LoadingMessage } from '../components/StatusMessage';
import { YearSelector } from '../components/YearSelector';
import { useAssetBalances } from '../hooks/useAssetBalances';
import { useYearParam } from '../hooks/useYearMonthParams';

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

const GROUP_LABELS: Record<AssetGroup, string> = {
  cash_deposit: '現金・預貯金',
  securities: '証券・株式',
  insurance: '保険',
};
const GROUP_COLORS: Record<AssetGroup, string> = {
  cash_deposit: '#4C6EF5',
  securities: '#F76707',
  insurance: '#12B886',
};

export function SC09_AssetManagement() {
  const [year, setYear] = useYearParam();
  const [group, setGroup] = useState<AssetGroupTabValue>('cash_deposit');
  const [showAddModal, setShowAddModal] = useState(false);
  const isNetWorth = group === 'net_worth';

  const { summary, loading, error, updateBalance, isSaving, reload } = useAssetBalances(year);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async (assetId: string, assetName: string) => {
    if (!window.confirm(`「${assetName}」を削除しますか？`)) return;
    setDeleteError(null);
    try {
      await deactivateAsset(assetId);
      await reload();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e));
    }
  };

  const groupRows = useMemo(
    () => summary.assets.filter((a) => a.assetGroup === group),
    [summary.assets, group]
  );

  const groupOwnerSubtotals = useMemo(() => {
    return summary.ownerSubtotals.map((owner) => {
      const months = new Array(12).fill(0);
      for (const row of groupRows) {
        if (row.ownerUserId === owner.ownerUserId) {
          row.months.forEach((amount, idx) => {
            months[idx] += amount;
          });
        }
      }
      return { ...owner, months };
    });
  }, [summary.ownerSubtotals, groupRows]);

  const groupTotal = useMemo(() => {
    const totals = new Array(12).fill(0);
    for (const row of groupRows) {
      row.months.forEach((amount, idx) => {
        totals[idx] += amount;
      });
    }
    return totals;
  }, [groupRows]);

  // 費目区分別（現金・預貯金／証券・株式／保険）の月次合計を、指定した口座だけを対象に集計
  const buildGroupSeries = (assetRows: typeof summary.assets) =>
    (Object.keys(GROUP_LABELS) as AssetGroup[]).map((g) => {
      const totals = new Array(12).fill(0);
      for (const row of assetRows.filter((a) => a.assetGroup === g)) {
        row.months.forEach((amount, idx) => {
          totals[idx] += amount;
        });
      }
      return { label: GROUP_LABELS[g], data: totals, borderColor: GROUP_COLORS[g] };
    });

  const ownerTrendCharts = useMemo(
    () =>
      summary.ownerSubtotals.map((owner) => ({
        ownerUserId: owner.ownerUserId,
        title: owner.displayName,
        datasets: buildGroupSeries(
          summary.assets.filter((a) => a.ownerUserId === owner.ownerUserId)
        ),
      })),
    [summary.assets, summary.ownerSubtotals]
  );

  const totalTrendDatasets = useMemo(
    () => buildGroupSeries(summary.assets),
    [summary.assets]
  );

  return (
    <div className="max-w-[1600px] mx-auto p-4 space-y-6">
      <YearSelector year={year} onChange={setYear} />

      <AssetGroupTab value={group} onChange={setGroup} />

      {loading && <LoadingMessage />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {deleteError && <ErrorMessage>{deleteError}</ErrorMessage>}

      {!loading && (
        <>
          {isNetWorth ? (
            <NetWorthSummary ownerSubtotals={summary.ownerSubtotals} total={summary.total} />
          ) : (
            <>
              <AssetBalanceTable
                rows={groupRows}
                ownerSubtotals={groupOwnerSubtotals}
                total={groupTotal}
                onCellChange={updateBalance}
                isSaving={isSaving}
                onDelete={handleDelete}
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  className="bg-blue-600 text-white rounded px-4 py-1.5 hover:bg-blue-700"
                  onClick={() => setShowAddModal(true)}
                >
                  ＋口座追加
                </button>
              </div>
            </>
          )}

          {ownerTrendCharts.map((chart) => (
            <section key={chart.ownerUserId} className="space-y-2">
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">資産推移（{chart.title}）</h2>
              <div className="h-64">
                <LineChart labels={MONTH_LABELS} datasets={chart.datasets} />
              </div>
            </section>
          ))}

          <section className="space-y-2">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">資産推移（総合計）</h2>
            <div className="h-64">
              <LineChart labels={MONTH_LABELS} datasets={totalTrendDatasets} />
            </div>
          </section>
        </>
      )}

      {showAddModal && !isNetWorth && (
        <AddAssetModal
          assetGroup={group}
          onClose={() => setShowAddModal(false)}
          onCreated={reload}
        />
      )}
    </div>
  );
}
