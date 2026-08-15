import { useEffect, useRef } from 'react';
import { NavLink, useLocation, useSearchParams } from 'react-router-dom';
import { clearSession } from '../api/client';
import { useTheme } from '../hooks/useTheme';

const NAV_ITEMS: { to: string; icon: string; label: string }[] = [
  { to: '/dashboard', icon: '🏠', label: 'ダッシュボード' },
  { to: '/transaction', icon: '✏️', label: '取引入力' },
  { to: '/transactions', icon: '📋', label: '取引一覧' },
  { to: '/settlement', icon: '🤝', label: '精算' },
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
  const location = useLocation();
  const activeRef = useRef<HTMLAnchorElement>(null);

  // 画面遷移時、横スクロールで隠れている可能性があるアクティブ項目を見える位置まで自動スクロールする。
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [location.pathname]);

  const handleLogout = () => {
    clearSession();
    window.location.href = '/login';
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="relative">
        <div className="flex overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                ref={isActive ? activeRef : undefined}
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
            );
          })}
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
        {/* 横スクロール可能であることを示す視覚的ヒント（右端のグラデーションフェード） */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white dark:from-gray-800 to-transparent" />
      </div>
    </nav>
  );
}
