import { useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getStorageProvider } from './index';
import type { StageData } from './types';

/**
 * Hook for publishing data to remote storage (teacher CMS).
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
        updatedAt: new Date().toISOString(),
      };

      await provider.save(data);
      setStatus('success');

      // Reset to idle after 3 seconds
      setTimeout(() => setStatus('idle'), 3000);
    } catch (e: any) {
      setStatus('error');
      setError(e.message || 'Unknown error');
    }
  }, []);

  return { publish, status, error };
}

/**
 * Hook for loading data from remote storage (student side).
 */
export function useFetchRemote() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string>('');

  const fetchRemote = useCallback(async () => {
    const provider = getStorageProvider();
    if (!provider) {
      // No provider configured — silently skip (student might be using local data)
      return;
    }

    // In dev mode, only load from local file if store is empty (seed data).
    // This prevents overwriting CMS edits stored in localStorage.
    if (import.meta.env.DEV && useAppStore.getState().slicesPool.length > 0) {
      return;
    }

    setStatus('loading');
    setError('');

    try {
      const data = await provider.load();
      if (data && data.slicesPool && data.slicesPool.length > 0) {
        // Replace pool and custom stages with remote data
        useAppStore.setState({
          slicesPool: data.slicesPool,
          customStages: data.customStages || [],
        });

        setStatus('success');
      } else {
        setStatus('idle'); // No remote data available
      }
    } catch (e: any) {
      setStatus('error');
      setError(e.message || 'Failed to load remote data');
    }
  }, []);

  return { fetchRemote, status, error };
}
