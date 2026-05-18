import { Outlet, Link, useLocation } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { usePublish, useFetchRemote } from '../../core/storage/useRemoteSync';
import { useAppStore } from '../../core/store/useAppStore';
import AccountMenu from '../../components/auth/AccountMenu';

const NAV_ITEMS = [
  { to: '/cms', label: '总览', end: true },
  { to: '/cms/parser', label: '文件解析器', end: false },
  { to: '/cms/creator', label: '手动出题器', end: false },
  { to: '/cms/builder', label: '题库管理', end: false },
  { to: '/cms/stages', label: '关卡编排', end: false },
  { to: '/cms/feedback', label: '反馈管理', end: false },
] as const;

export default function CMSLayout() {
  const { publish, status, error } = usePublish();
  const { fetchRemote } = useFetchRemote();
  const poolSize = useAppStore(state => state.slicesPool.length);
  const location = useLocation();

  useEffect(() => {
    if (poolSize === 0) {
      fetchRemote();
    }
  }, []);

  const publishBtnClass = useMemo(() => {
    return `cms-publish-btn ${status}`;
  }, [status]);

  const publishLabel = useMemo(() => {
    switch (status) {
      case 'saving': return '⏳ 发布中...';
      case 'success': return '✅ 已发布!';
      case 'error': return '❌ 发布失败';
      default: return '🚀 发布到云端';
    }
  }, [status]);

  return (
    <div className="cms-layout">
      <aside className="cms-sidebar">
        <h2 className="cms-sidebar-title">智能教研引擎</h2>
        <div className="cms-sidebar-account">
          <AccountMenu />
        </div>
        <nav className="cms-sidebar-nav">
          {NAV_ITEMS.map(item => {
            const active = item.end
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`cms-nav-link${active ? ' active' : ''}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="cms-publish-section">
          <button
            onClick={publish}
            disabled={status === 'saving'}
            className={publishBtnClass}
          >
            {publishLabel}
          </button>
          {status === 'error' && error && (
            <p className="cms-publish-error">{error}</p>
          )}
          <p className="cms-publish-hint">
            发布后学生端可立即看到更新
          </p>
        </div>
      </aside>
      <main className="cms-main">
        <Outlet />
      </main>
    </div>
  );
}
