import { useEffect } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useFetchRemote } from '../../core/storage/useRemoteSync';

export default function ClientLayout() {
  const { fetchRemote, status } = useFetchRemote();

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
          <span style={{ background: '#fef3c7', color: '#d97706', padding: '6px 16px', borderRadius: '20px', fontWeight: '800', fontSize: '1.1rem' }}>
            ⭐ 120
          </span>
        </div>
      </header>
      <main style={{ flex: 1, padding: '40px', display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </main>
    </div>
  );
}
