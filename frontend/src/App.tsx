import { useState } from 'react';
import { CategoryMaster } from './pages/CategoryMaster';
import { IncomeAndPreSaving } from './pages/IncomeAndPreSaving';
import { WeeklyBudget } from './pages/WeeklyBudget';
import { TransactionInput } from './pages/TransactionInput';
import { SC02_Dashboard } from './pages/SC02_Dashboard';
import { SC07_AnnualTrend } from './pages/SC07_AnnualTrend';

type Screen =
  | 'dashboard'
  | 'transaction'
  | 'income'
  | 'weeklyBudget'
  | 'categoryMaster'
  | 'annualTrend';

const SCREENS: { key: Screen; label: string }[] = [
  { key: 'dashboard', label: 'ダッシュボード' },
  { key: 'transaction', label: '取引入力' },
  { key: 'income', label: '収入・先取り貯金入力' },
  { key: 'weeklyBudget', label: '週次予算設定' },
  { key: 'categoryMaster', label: '費目マスタ管理' },
  { key: 'annualTrend', label: '年間推移' },
];

// 他画面(SC01, SC04, SC08, SC09, SC11)は未実装のため、簡易ナビで実装済み画面のみ切り替える。
// ルーティングライブラリはまだ導入していないため、フェーズ1完了時に react-router 等へ置き換え予定。
export default function App() {
  const [screen, setScreen] = useState<Screen>('dashboard');

  return (
    <div>
      <nav className="border-b border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto flex gap-1 px-4">
          {SCREENS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setScreen(s.key)}
              className={`px-3 py-2 text-sm border-b-2 ${
                screen === s.key
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </nav>
      {screen === 'dashboard' && <SC02_Dashboard />}
      {screen === 'transaction' && <TransactionInput />}
      {screen === 'income' && <IncomeAndPreSaving />}
      {screen === 'weeklyBudget' && <WeeklyBudget />}
      {screen === 'categoryMaster' && <CategoryMaster />}
      {screen === 'annualTrend' && <SC07_AnnualTrend />}
    </div>
  );
}
