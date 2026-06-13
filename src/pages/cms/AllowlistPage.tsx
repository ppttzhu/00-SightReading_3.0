import { useState, useEffect } from 'react';
import { supabase } from '../../core/auth/supabaseClient';
import { parseBatchNicknames } from './utils/parseBatchNicknames';

interface AllowlistEntry {
  id: string;
  nickname: string;
  profile_id: string | null;
  email: string | null;
  created_at: string;
  registered_at: string | null;
  profiles: { id: string; nickname: string } | null;
}

export default function AllowlistPage() {
  const [entries, setEntries] = useState<AllowlistEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Single add state
  const [newNickname, setNewNickname] = useState('');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  // Batch import state
  const [batchInput, setBatchInput] = useState('');
  const [batchResult, setBatchResult] = useState<{ added: number; skipped: number } | null>(null);
  const [batching, setBatching] = useState(false);

  // Search & pagination state
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    fetchEntries();
  }, [page, searchQuery]);

  function handleSearch() {
    setPage(0);
    setSearchQuery(searchInput);
  }

  async function fetchEntries() {
    setLoading(true);
    setError('');
    try {
      if (!supabase) throw new Error('Supabase 尚未配置。');

      let query = supabase
        .from('allowlist')
        .select('id, nickname, profile_id, email, created_at, registered_at, profiles ( id, nickname )', { count: 'exact' });

      // Server-side search: filter by nickname or email using ilike
      if (searchQuery.trim()) {
        const pattern = `%${searchQuery.trim()}%`;
        query = query.or(`nickname.ilike.${pattern},email.ilike.${pattern}`);
      }

      const { data, error: fetchError, count } = await query
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (fetchError) throw new Error(fetchError.message);
      setEntries((data as unknown as AllowlistEntry[]) || []);
      setTotalCount(count ?? 0);
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddSingle() {
    const trimmed = newNickname.trim();
    if (!trimmed) return;
    setAddError('');
    setAdding(true);
    try {
      if (!supabase) throw new Error('Supabase 尚未配置。');
      const { error: insertError } = await supabase
        .from('allowlist')
        .insert({ nickname: trimmed });

      if (insertError) {
        // Unique constraint violation
        if (insertError.code === '23505') {
          setAddError('该昵称已存在于名单中。');
        } else {
          setAddError(insertError.message);
        }
        return;
      }
      setNewNickname('');
      await fetchEntries();
    } catch (e: any) {
      setAddError(e.message || '操作失败，请稍后再试。');
    } finally {
      setAdding(false);
    }
  }

  async function handleBatchImport() {
    const nicknames = parseBatchNicknames(batchInput);
    if (nicknames.length === 0) return;
    setBatchResult(null);
    setBatching(true);
    try {
      if (!supabase) throw new Error('Supabase 尚未配置。');
      const { data, error: upsertError } = await supabase
        .from('allowlist')
        .upsert(
          nicknames.map(nickname => ({ nickname })),
          { onConflict: 'nickname', ignoreDuplicates: true }
        )
        .select();

      if (upsertError) throw new Error(upsertError.message);
      const added = data?.length ?? 0;
      const skipped = nicknames.length - added;
      setBatchResult({ added, skipped });
      setBatchInput('');
      await fetchEntries();
    } catch (e: any) {
      setError(e.message || '操作失败，请稍后再试。');
    } finally {
      setBatching(false);
    }
  }

  async function handleDelete(entry: AllowlistEntry) {
    // If entry has a linked profile, confirm before deleting
    if (entry.profile_id) {
      const confirmed = window.confirm(
        `该昵称"${entry.nickname}"已关联注册用户，此操作并不能删除已有用户，确定要删除吗？`
      );
      if (!confirmed) return;
    }

    try {
      if (!supabase) throw new Error('Supabase 尚未配置。');
      const { error: deleteError } = await supabase
        .from('allowlist')
        .delete()
        .eq('id', entry.id);

      if (deleteError) throw new Error(deleteError.message);
      await fetchEntries();
    } catch (e: any) {
      setError(e.message || '删除失败');
    }
  }

  return (
    <div>
      {/* Page title */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1f2937', margin: 0, letterSpacing: '-0.5px' }}>
          学生注册名单
        </h1>
        <p style={{ color: '#6b7280', marginTop: '6px', fontSize: '0.9rem' }}>
          管理允许注册的学生昵称。学生必须使用名单中的昵称才能完成注册。
        </p>
      </div>

      {/* Global error */}
      {error && (
        <div className="cms-error-banner">
          {error}
          <button onClick={() => setError('')} className="cms-btn-danger" style={{ marginLeft: '12px' }}>
            ✕
          </button>
        </div>
      )}

      {/* Single add section */}
      <div className="cms-card" style={{ marginBottom: '16px' }}>
        <h3 className="cms-card-title">添加单个昵称</h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              className="cms-input"
              value={newNickname}
              onChange={(e) => { setNewNickname(e.target.value); setAddError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddSingle(); }}
              placeholder="输入学生昵称..."
            />
            {addError && (
              <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: '#dc2626' }}>{addError}</p>
            )}
          </div>
          <button onClick={handleAddSingle} disabled={adding || !newNickname.trim()} className="cms-btn">
            {adding ? '添加中...' : '添加'}
          </button>
        </div>
      </div>

      {/* Batch import section */}
      <div className="cms-card" style={{ marginBottom: '24px' }}>
        <h3 className="cms-card-title">批量导入</h3>
        <p style={{ margin: '0 0 10px', fontSize: '0.82rem', color: '#6b7280' }}>
          每行一个昵称。重复的昵称会自动跳过。
        </p>
        <textarea
          className="cms-input"
          value={batchInput}
          onChange={(e) => { setBatchInput(e.target.value); setBatchResult(null); }}
          placeholder="小明&#10;小红&#10;小美"
          rows={4}
          style={{ resize: 'vertical', fontFamily: 'inherit' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
          <button onClick={handleBatchImport} disabled={batching || !batchInput.trim()} className="cms-btn">
            {batching ? '导入中...' : '批量导入'}
          </button>
          {batchResult && (
            <span style={{ fontSize: '0.85rem', color: '#059669', fontWeight: 600 }}>
              已添加 {batchResult.added} 个，跳过 {batchResult.skipped} 个重复昵称。
            </span>
          )}
        </div>
      </div>

      {/* Entries list header */}
      <h3 className="cms-card-title" style={{ marginBottom: '8px' }}>
        名单列表 ({totalCount})
      </h3>

      {/* Search */}
      <div style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
        <input
          type="text"
          className="cms-input"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          placeholder="搜索昵称或邮箱..."
          style={{ maxWidth: '300px' }}
        />
        <button onClick={handleSearch} className="cms-btn-secondary">搜索</button>
        {searchQuery && (
          <button onClick={() => { setSearchInput(''); setSearchQuery(''); setPage(0); }} className="cms-btn-secondary">
            重置
          </button>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <div className="cms-spinner" />
        </div>
      ) : entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px', opacity: 0.3 }}>📋</div>
          <p style={{ fontWeight: 600, color: '#6b7280', margin: 0 }}>
            {searchQuery.trim() ? '没有匹配的结果' : '名单为空'}
          </p>
          <p style={{ fontSize: '0.85rem', marginTop: '6px' }}>
            {searchQuery.trim() ? '请尝试其他关键词。' : '添加学生昵称后会显示在这里。'}
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {entries.map((entry) => (
              <div
                key={entry.id}
                className={`cms-allowlist-entry ${entry.profile_id ? 'cms-allowlist-entry--registered' : 'cms-allowlist-entry--pending'}`}
              >
                <div>
                  <span style={{ fontWeight: 700, color: '#1f2937', fontSize: '0.95rem' }}>
                    {entry.nickname}
                  </span>
                  <div style={{ marginTop: '2px', fontSize: '0.78rem', color: '#6b7280' }}>
                    {entry.profile_id ? (
                      <span style={{ color: '#059669' }}>
                        已注册 · {entry.email || entry.nickname} · 注册: {entry.registered_at ? new Date(entry.registered_at).toLocaleDateString('zh-CN') : ''} · 添加: {new Date(entry.created_at).toLocaleDateString('zh-CN')}
                      </span>
                    ) : (
                      <span>未注册 · 添加: {new Date(entry.created_at).toLocaleDateString('zh-CN')}</span>
                    )}
                  </div>
                </div>
                <button onClick={() => handleDelete(entry)} className="cms-btn-danger">删除</button>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalCount > PAGE_SIZE && (() => {
            const totalPages = Math.ceil(totalCount / PAGE_SIZE);
            return (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="cms-btn-secondary">
                  ‹ 上一页
                </button>
                <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{page + 1} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="cms-btn-secondary">
                  下一页 ›
                </button>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
