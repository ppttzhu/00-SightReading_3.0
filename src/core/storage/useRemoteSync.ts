import { useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getStorageProvider } from './index';
import { migrateLocalProgressToSupabase } from './syncOps';
import type { StageData } from './types';

/**
 * Hook for publishing data to remote storage (teacher CMS).
 *
 * 注意：在 Supabase 实时同步模式下，每次 mutation 都已经 fire-and-forget 写库；
 * 此 hook 保留为 "全量重推" 兜底按钮，触发一次 SupabaseStorageProvider.save() 整包同步。
 */
export function usePublish() {
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string>('');

  const publish = useCallback(async () => {
    const provider = getStorageProvider();
    if (!provider) {
      setStatus('error');
      setError('Remote storage not configured. Check .env file.');
      return;
    }

    setStatus('saving');
    setError('');

    try {
      const state = useAppStore.getState();
      const data: StageData = {
        slicesPool: state.slicesPool,
        customStages: state.customStages,
        adventureStages: state.adventureStages,
        updatedAt: new Date().toISOString(),
      };

      await provider.save(data);
      useAppStore.setState({ lastSyncError: null });
      setStatus('success');

      setTimeout(() => setStatus('idle'), 3000);
    } catch (e: any) {
      setStatus('error');
      setError(e.message || 'Unknown error');
    }
  }, []);

  return { publish, status, error };
}

/**
 * Hook for loading data from remote storage (student side / CMS startup).
 */
export function useFetchRemote() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string>('');

  const fetchRemote = useCallback(async () => {
    const provider = getStorageProvider();
    if (!provider) return;

    // 一次性迁移：已登录学生首次加载时，把 localStorage 进度推送到 Supabase
    void migrateLocalProgressToSupabase();

    // 开发模式：本地 store 已有数据则跳过，避免覆盖未提交的 CMS 编辑
    if (import.meta.env.DEV && useAppStore.getState().slicesPool.length > 0) {
      return;
    }

    setStatus('loading');
    setError('');

    try {
      await useAppStore.getState().loadFromRemote();
      const syncErr = useAppStore.getState().lastSyncError;
      if (syncErr) {
        setStatus('error');
        setError(syncErr);
      } else {
        const pool = useAppStore.getState().slicesPool;
        setStatus(pool.length > 0 ? 'success' : 'idle');
      }
    } catch (e: any) {
      setStatus('error');
      setError(e.message || 'Failed to load remote data');
    }
  }, []);

  return { fetchRemote, status, error };
}

