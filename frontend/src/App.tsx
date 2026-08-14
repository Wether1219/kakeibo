import { Navigate, Route, Routes } from 'react-router-dom';
import { NavBar } from './components/NavBar';
import { CategoryMaster } from './pages/CategoryMaster';
import { IncomeAndPreSaving } from './pages/IncomeAndPreSaving';
import { WeeklyBudget } from './pages/WeeklyBudget';
import { TransactionInput } from './pages/TransactionInput';
import { SC02_Dashboard } from './pages/SC02_Dashboard';
import { SC07_AnnualTrend } from './pages/SC07_AnnualTrend';
import { SC08_Visualization } from './pages/SC08_Visualization';
import { SC09_AssetManagement } from './pages/SC09_AssetManagement';

// 他画面(SC01, SC04, SC11)は未実装のため、実装済み画面のみルーティングする。
export default function App() {
  return (
    <div className="pb-16">
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<SC02_Dashboard />} />
        <Route path="/transaction" element={<TransactionInput />} />
        <Route path="/income" element={<IncomeAndPreSaving />} />
        <Route path="/weekly-budget" element={<WeeklyBudget />} />
        <Route path="/category-master" element={<CategoryMaster />} />
        <Route path="/annual-trend" element={<SC07_AnnualTrend />} />
        <Route path="/visualization" element={<SC08_Visualization />} />
        <Route path="/asset-management" element={<SC09_AssetManagement />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <NavBar />
    </div>
  );
}
