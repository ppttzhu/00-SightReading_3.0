import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useMatch } from 'react-router-dom';
import { UserCircle, BookOpen, Trophy, Loader2, LogOut, MessageSquare, MoreHorizontal, X } from 'lucide-react';
import { useAuth } from '../../core/auth/AuthProvider';
import FeedbackDrawer from '../../components/FeedbackDrawer';
import PracticeRecordsTab from './profile/PracticeRecordsTab';
import EffortLeaderboardTab from './profile/EffortLeaderboardTab';

type TabKey = 'record' | 'ranking';

const NAV_ITEMS: { key: TabKey; label: string; icon: typeof BookOpen; path: string }[] = [
  { key: 'ranking', label: '排行榜', icon: Trophy, path: '/client/profile/ranking' },
  { key: 'record', label: '做题记录', icon: BookOpen, path: '/client/profile/record' },
];

export default function ProfilePage() {
  const { profile, loading, profileLoading, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Derive active tab from URL path
  const matchRecord = useMatch('/client/profile/record');
  const activeTab: TabKey = matchRecord ? 'record' : 'ranking';

  const [signOutError, setSignOutError] = useState('');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading || profileLoading) {
    return (
      <div className="profile-layout">
        <div className="profile-loading">
          <Loader2 size={24} className="spin-icon" />
        </div>
      </div>
    );
  }

  if (!profile) {
    const returnTo = encodeURIComponent(location.pathname);
    return <Navigate to={`/auth?returnTo=${returnTo}`} replace />;
  }

  return (
    <div className="profile-layout">
      {/* Mobile menu toggle button */}
      <button
        className="profile-mobile-menu-btn"
        onClick={() => setMobileMenuOpen(true)}
        aria-label="打开菜单"
      >
        <MoreHorizontal size={20} />
      </button>

      {/* Overlay backdrop */}
      {mobileMenuOpen && (
        <div
          className="profile-mobile-overlay"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside className={`profile-sidebar${mobileMenuOpen ? ' open' : ''}`}>
        <button
          className="profile-mobile-close-btn"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="关闭菜单"
        >
          <X size={20} />
        </button>
        <div className="profile-sidebar-header">
          <UserCircle size={36} color="#3b82f6" strokeWidth={1.5} />
          <h2 className="profile-sidebar-nickname">{profile.nickname}</h2>
        </div>
        <nav className="profile-sidebar-nav">
          {NAV_ITEMS.map(item => {
            const active = activeTab === item.key;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                className={`profile-nav-link${active ? ' active' : ''}`}
                onClick={() => {
                  navigate(item.path);
                  setMobileMenuOpen(false);
                }}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="profile-sidebar-footer">
          <button
            className="profile-nav-link"
            onClick={() => {
              setFeedbackOpen(true);
              setMobileMenuOpen(false);
            }}
          >
            <MessageSquare size={16} /> 意见反馈
          </button>
          <button
            className="profile-nav-link"
            onClick={async () => {
              setSignOutError('');
              try { await signOut(); } catch (e) {
                setSignOutError(e instanceof Error ? e.message : '退出失败');
              }
            }}
          >
            <LogOut size={16} /> 退出登录
          </button>
          {signOutError && <span className="profile-signout-error">{signOutError}</span>}
        </div>
      </aside>
      <main className="profile-main">
        {activeTab === 'ranking' ? <EffortLeaderboardTab /> : <PracticeRecordsTab />}
      </main>
      <FeedbackDrawer open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}
