import { useEffect, useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useFetchRemote } from '../../core/storage/useRemoteSync';
import FeedbackDrawer from '../../components/FeedbackDrawer';
import AccountMenu from '../../components/auth/AccountMenu';

export default function ClientLayout() {
  const { fetchRemote, status } = useFetchRemote();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    fetchRemote();
  }, [fetchRemote]);

  return (
    <div className="client-layout">
      <header className="client-header">
        <Link to="/client" className="client-logo">
          ✨ Sight-Reading Adventure
        </Link>
        <div className="client-header-right">
          {status === 'loading' && (
            <span className="client-sync-status">⏳ Syncing...</span>
          )}
          <AccountMenu />
        </div>
      </header>
      <main className="client-main">
        <Outlet />
      </main>

      <div className="client-feedback-wrapper">
        <button className="client-feedback-btn" onClick={() => setDrawerOpen(true)}>
          意见反馈
        </button>
      </div>

      <FeedbackDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
