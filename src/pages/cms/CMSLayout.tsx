import { Outlet, Link, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { usePublish, useFetchRemote } from '../../core/storage/useRemoteSync';
import { useAppStore } from '../../core/store/useAppStore';
import AccountMenu from '../../components/auth/AccountMenu';

const NAV_ITEMS = [
  { to: '/cms', label: '总览', end: true },
  { to: '/cms/stats', label: '学生统计', end: false },
  { to: '/cms/parser', label: '文件解析器', end: false },
  { to: '/cms/creator', label: '手动出题器', end: false },
  { to: '/cms/builder', label: '题库管理', end: false },
  { to: '/cms/stages', label: '关卡编排', end: false },
  { to: '/cms/adventure', label: '主线编排', end: false },
  { to: '/cms/feedback', label: '反馈管理', end: false },
] as const;

export default function CMSLayout() {
  const { publish, status, error } = usePublish();
  const { fetchRemote } = useFetchRemote();
  const poolSize = useAppStore(state => state.slicesPool.length);
  const location = useLocation();

  // persist 中间件异步恢复；hydration 完成前禁止发布，防止空数据误清远端
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // zustand v5 persist API
    const unsub = useAppStore.persist.onFinishHydration(() => setHydrated(true));
    if (useAppStore.persist.hasHydrated()) setHydrated(true);
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    if (hydrated && poolSize === 0) {
      fetchRemote();
    }
  }, [hydrated]);

  const publishDisabled = status === 'saving' || !hydrated || poolSize === 0;

  const publishBtnClass = useMemo(() => {
    return `cms-publish-btn ${status}`;
  }, [status]);

  const publishLabel = useMemo(() => {
    if (!hydrated) return '⏳ 数据加载中...';
    if (poolSize === 0) return '📭 题库为空';
    switch (status) {
      case 'saving': return '⏳ 发布中...';
      case 'success': return '✅ 已发布!';
      case 'error': return '❌ 发布失败';
      default: return `🚀 发布到云端 (${poolSize}题)`;
    }
  }, [status, hydrated, poolSize]);

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
            disabled={publishDisabled}
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
