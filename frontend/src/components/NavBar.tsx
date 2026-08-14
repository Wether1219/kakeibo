import { NavLink, useSearchParams } from 'react-router-dom';
import { clearSession } from '../api/client';
import { useTheme } from '../hooks/useTheme';

const NAV_ITEMS: { to: string; icon: string; label: string }[] = [
  { to: '/dashboard', icon: '🏠', label: 'ダッシュボード' },
  { to: '/transaction', icon: '✏️', label: '取引入力' },
  { to: '/transactions', icon: '📋', label: '取引一覧' },
  { to: '/income', icon: '💰', label: '収入・貯金' },
  { to: '/weekly-budget', icon: '📅', label: '週次予算' },
  { to: '/category-master', icon: '🏷️', label: '費目マスタ' },
  { to: '/annual-trend', icon: '📈', label: '年間推移' },
  { to: '/visualization', icon: '📊', label: '収支可視化' },
  { to: '/asset-management', icon: '🏦', label: '資産管理' },
  { to: '/settings', icon: '⚙️', label: '設定・履歴' },
];

// スマホ実機幅(375px)で8項目を収めるため、画面下部固定・横スクロールのボトムナビとして実装。
// 年・月の選択状態(?year=&month=)は遷移先にもそのまま引き継ぐ。
export function NavBar() {
  const [searchParams] = useSearchParams();
  const search = searchParams.toString();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = () => {
    clearSession();
    window.location.href = '/login';
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex overflow-x-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={search ? `${item.to}?${search}` : item.to}
            className={({ isActive }) =>
              `flex flex-shrink-0 flex-col items-center justify-center gap-0.5 px-3 py-1.5 min-w-[4.5rem] text-[11px] ${
                isActive ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-500 dark:text-gray-400'
              }`
            }
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span className="whitespace-nowrap">{item.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={toggleTheme}
          className="flex flex-shrink-0 flex-col items-center justify-center gap-0.5 px-3 py-1.5 min-w-[4.5rem] text-[11px] text-gray-500 dark:text-gray-400"
        >
          <span className="text-lg leading-none">{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span className="whitespace-nowrap">{theme === 'dark' ? 'ライト' : 'ダーク'}</span>
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="flex flex-shrink-0 flex-col items-center justify-center gap-0.5 px-3 py-1.5 min-w-[4.5rem] text-[11px] text-gray-500 dark:text-gray-400"
        >
          <span className="text-lg leading-none">🚪</span>
          <span className="whitespace-nowrap">ログアウト</span>
        </button>
      </div>
    </nav>
  );
}
