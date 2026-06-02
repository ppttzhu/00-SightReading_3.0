import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useFetchRemote } from '../../core/storage/useRemoteSync';
import { useAppStore } from '../../core/store/useAppStore';
import FeedbackDrawer from '../../components/FeedbackDrawer';
import AccountMenu from '../../components/auth/AccountMenu';

export default function ClientLayout() {
  const { fetchRemote } = useFetchRemote();
  const loadAdventureProgress = useAppStore(s => s.loadAdventureProgressFromRemote);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const isProfilePage = location.pathname.startsWith('/client/profile');

  useEffect(() => {
    fetchRemote();
    loadAdventureProgress();
  }, [fetchRemote, loadAdventureProgress]);

  return (
    <div className="client-layout">
      <header className="client-header">
        <Link to="/client" className="client-logo">
          ✨ Sight-Reading Adventure
        </Link>
        <div className="client-header-right">
          <AccountMenu />
        </div>
      </header>
      <main className="client-main">
        <Outlet />
      </main>

      {!isProfilePage && (
        <div className="client-feedback-wrapper">
          <button className="client-feedback-btn" onClick={() => setDrawerOpen(true)}>
            意见反馈
          </button>
        </div>
      )}

      <FeedbackDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
