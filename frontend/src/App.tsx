import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { NavBar } from './components/NavBar';
import { CategoryMaster } from './pages/CategoryMaster';
import { IncomeAndPreSaving } from './pages/IncomeAndPreSaving';
import { WeeklyBudget } from './pages/WeeklyBudget';
import { TransactionInput } from './pages/TransactionInput';
import { SC01_Login } from './pages/SC01_Login';
import { SC02_Dashboard } from './pages/SC02_Dashboard';
import { SC04_TransactionList } from './pages/SC04_TransactionList';
import { SC07_AnnualTrend } from './pages/SC07_AnnualTrend';
import { SC08_Visualization } from './pages/SC08_Visualization';
import { SC09_AssetManagement } from './pages/SC09_AssetManagement';
import { SC11_Settings } from './pages/SC11_Settings';
import { isLoggedIn } from './api/client';

export default function App() {
  const location = useLocation();
  const authed = isLoggedIn();

  if (location.pathname === '/login') {
    if (authed) return <Navigate to="/dashboard" replace />;
    return <SC01_Login />;
  }

  if (!authed) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="pb-16">
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<SC02_Dashboard />} />
        <Route path="/transaction" element={<TransactionInput />} />
        <Route path="/transactions" element={<SC04_TransactionList />} />
        <Route path="/income" element={<IncomeAndPreSaving />} />
        <Route path="/weekly-budget" element={<WeeklyBudget />} />
        <Route path="/category-master" element={<CategoryMaster />} />
        <Route path="/annual-trend" element={<SC07_AnnualTrend />} />
        <Route path="/visualization" element={<SC08_Visualization />} />
        <Route path="/asset-management" element={<SC09_AssetManagement />} />
        <Route path="/settings" element={<SC11_Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <NavBar />
    </div>
  );
}
