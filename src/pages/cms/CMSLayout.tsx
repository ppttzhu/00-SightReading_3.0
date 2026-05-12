import { Outlet, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { usePublish, useFetchRemote } from '../../core/storage/useRemoteSync';
import { useAppStore } from '../../core/store/useAppStore';

export default function CMSLayout() {
  const { publish, status, error } = usePublish();
  const { fetchRemote } = useFetchRemote();
  const poolSize = useAppStore(state => state.slicesPool.length);

  // Load remote data on mount if local store is empty (new browser)
  useEffect(() => {
    if (poolSize === 0) {
      fetchRemote();
    }
  }, []);

  return (
    <div className="cms-layout" style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <aside style={{ width: '250px', background: '#f4f4f5', padding: '20px', borderRight: '1px solid #e4e4e7', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '20px', color: '#18181b' }}>智能教研引擎</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
          <Link to="/cms" style={{ textDecoration: 'none', color: '#3f3f46', padding: '8px', borderRadius: '4px' }}>总览</Link>
          <Link to="/cms/parser" style={{ textDecoration: 'none', color: '#3f3f46', padding: '8px', borderRadius: '4px' }}>文件解析器</Link>
          <Link to="/cms/creator" style={{ textDecoration: 'none', color: '#3f3f46', padding: '8px', borderRadius: '4px' }}>手动出题器</Link>
          <Link to="/cms/builder" style={{ textDecoration: 'none', color: '#3f3f46', padding: '8px', borderRadius: '4px' }}>题库管理</Link>
          <Link to="/cms/stages" style={{ textDecoration: 'none', color: '#7c3aed', padding: '8px', borderRadius: '4px', fontWeight: 600 }}>关卡编排 ✨</Link>
        </nav>

        {/* Publish Button */}
        <div style={{ borderTop: '1px solid #e4e4e7', paddingTop: '16px', marginTop: '16px' }}>
          <button
            onClick={publish}
            disabled={status === 'saving'}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: status === 'success' ? '#059669' : status === 'error' ? '#dc2626' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.95rem',
              fontWeight: '700',
              cursor: status === 'saving' ? 'wait' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {status === 'saving' && '⏳ 发布中...'}
            {status === 'success' && '✅ 已发布!'}
            {status === 'error' && '❌ 发布失败'}
            {status === 'idle' && '🚀 发布到云端'}
          </button>
          {status === 'error' && error && (
            <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '8px', wordBreak: 'break-word' }}>
              {error}
            </p>
          )}
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '8px', textAlign: 'center' }}>
            发布后学生端可立即看到更新
          </p>
        </div>
      </aside>
      <main style={{ flex: 1, padding: '40px', background: '#ffffff' }}>
        <Outlet />
      </main>
    </div>
  );
}
