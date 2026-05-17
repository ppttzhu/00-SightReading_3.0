import { useEffect, useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useFetchRemote } from '../../core/storage/useRemoteSync';
import FeedbackDrawer from '../../components/FeedbackDrawer';
import AccountMenu from '../../components/auth/AccountMenu';

export default function ClientLayout() {
  const { fetchRemote, status } = useFetchRemote();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Auto-fetch remote data on mount
  useEffect(() => {
    fetchRemote();
  }, [fetchRemote]);

  return (
    <div className="client-layout" style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <header style={{
        padding: '20px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
      }}>
        <Link to="/client" style={{ textDecoration: 'none', color: '#3b82f6', fontSize: '1.5rem', fontWeight: '800', letterSpacing: '-0.5px' }}>
          ✨ Sight-Reading Adventure
        </Link>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          {status === 'loading' && (
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>⏳ Syncing...</span>
          )}
          <AccountMenu />
        </div>
      </header>
      <main style={{ flex: 1, padding: '40px', display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </main>

      {/* Feedback link */}
      <div style={{ textAlign: 'center', padding: '16px' }}>
        <button
          onClick={() => setDrawerOpen(true)}
          style={{
            fontSize: '12px',
            color: '#9ca3af',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'none',
          }}
          onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline'; }}
          onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none'; }}
        >
          意见反馈
        </button>
      </div>

      <FeedbackDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
