import { useState, useEffect } from 'react';

interface FeedbackEntry {
  id: string;
  category: 'feature' | 'bug';
  nickname: string;
  content: string;
  status: 'new' | 'read' | 'resolved';
  timestamp: string;
}

const AUTH_HEADER = `Bearer ${import.meta.env.VITE_CMS_SECRET || ''}`;

type FilterTab = 'all' | 'feature' | 'bug' | 'new';

function StatusBadge({ status }: { status: FeedbackEntry['status'] }) {
  const map: Record<FeedbackEntry['status'], { label: string; color: string; bg: string }> = {
    new: { label: '新提交', color: '#dc2626', bg: '#fef2f2' },
    read: { label: '已读', color: '#d97706', bg: '#fffbeb' },
    resolved: { label: '已解决', color: '#059669', bg: '#f0fdf4' },
  };
  const s = map[status];
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '999px',
      fontSize: '0.75rem',
      fontWeight: 600,
      color: s.color,
      background: s.bg,
    }}>
      {s.label}
    </span>
  );
}

function CategoryBadge({ category }: { category: FeedbackEntry['category'] }) {
  const isFeature = category === 'feature';
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '999px',
      fontSize: '0.75rem',
      fontWeight: 600,
      color: isFeature ? '#1d4ed8' : '#b91c1c',
      background: isFeature ? '#eff6ff' : '#fef2f2',
    }}>
      {isFeature ? '✨ 功能建议' : '🐛 Bug 反馈'}
    </span>
  );
}

interface TabDef { key: FilterTab; label: string }

const TABS: TabDef[] = [
  { key: 'all', label: '全部' },
  { key: 'feature', label: '功能建议' },
  { key: 'bug', label: 'Bug 反馈' },
  { key: 'new', label: '新提交' },
];

export default function FeedbackManager() {
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const fetchEntries = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/feedback', {
        headers: { Authorization: AUTH_HEADER },
      });
      if (res.status === 401) {
        setError('未授权：请检查 VITE_CMS_SECRET 配置');
        setEntries([]);
        return;
      }
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setEntries(data.entries || []);
      }
    } catch {
      setError('网络错误，无法加载反馈数据');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const counts = entries.reduce((acc, e) => {
    if (e.status === 'new') acc.new++;
    else if (e.status === 'read') acc.read++;
    else if (e.status === 'resolved') acc.resolved++;
    return acc;
  }, { new: 0, read: 0, resolved: 0 });

  const filteredEntries = entries.filter(e => {
    if (filter === 'feature' && e.category !== 'feature') return false;
    if (filter === 'bug' && e.category !== 'bug') return false;
    if (filter === 'new' && e.status !== 'new') return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!e.content.toLowerCase().includes(q) && !e.nickname.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const updateStatus = async (id: string, status: FeedbackEntry['status']) => {
    const previous = entries.find(e => e.id === id);
    setEntries(prev => prev.map(e => (e.id === id ? { ...e, status } : e)));

    try {
      const res = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: AUTH_HEADER,
        },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error();
    } catch {
      if (previous) {
        setEntries(prev => prev.map(e => (e.id === id ? previous : e)));
      }
    }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('确定要删除这条反馈吗？此操作不可撤销。')) return;

    const previous = entries;
    setEntries(prev => prev.filter(e => e.id !== id));

    try {
      const res = await fetch(`/api/feedback?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: AUTH_HEADER },
      });
      if (!res.ok) throw new Error();
    } catch {
      setEntries(previous);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 6px', color: '#111827' }}>
          📬 反馈管理
        </h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
          查看、筛选和管理学生提交的反馈
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
        }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#dc2626' }}>{counts.new}</div>
          <div style={{ fontSize: '0.85rem', color: '#991b1b', marginTop: '4px' }}>新提交</div>
        </div>
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          background: '#fffbeb',
          border: '1px solid #fde68a',
        }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#d97706' }}>{counts.read}</div>
          <div style={{ fontSize: '0.85rem', color: '#92400e', marginTop: '4px' }}>已读</div>
        </div>
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
        }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#059669' }}>{counts.resolved}</div>
          <div style={{ fontSize: '0.85rem', color: '#166534', marginTop: '4px' }}>已解决</div>
        </div>
      </div>

      {/* Filters + Search */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: filter === tab.key ? '1px solid #3b82f6' : '1px solid #d1d5db',
                background: filter === tab.key ? '#eff6ff' : '#ffffff',
                color: filter === tab.key ? '#1d4ed8' : '#374151',
                fontSize: '0.85rem',
                fontWeight: filter === tab.key ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索内容或昵称..."
          style={{
            flex: 1,
            minWidth: '200px',
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            fontSize: '0.85rem',
            outline: 'none',
          }}
        />
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#dc2626',
          marginBottom: '16px',
          fontSize: '0.9rem',
        }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#6b7280' }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid #e5e7eb',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px',
          }} />
          加载中...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Empty */}
      {!loading && filteredEntries.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
          暂无反馈，学生提交后会显示在这里
        </div>
      )}

      {/* Cards */}
      {!loading && filteredEntries.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredEntries.map(entry => (
            <div
              key={entry.id}
              style={{
                padding: '16px',
                borderRadius: '10px',
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderLeftWidth: '4px',
                borderLeftColor: entry.category === 'feature' ? '#3b82f6' : '#ef4444',
              }}
            >
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
                <CategoryBadge category={entry.category} />
                <StatusBadge status={entry.status} />
                <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                  {new Date(entry.timestamp).toLocaleString('zh-CN')}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  👤 {entry.nickname}
                </span>
              </div>

              <div style={{
                fontSize: '0.9rem',
                color: '#1f2937',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                marginBottom: '12px',
              }}>
                {entry.content}
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {entry.status !== 'new' && (
                  <button
                    onClick={() => updateStatus(entry.id, 'new')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      border: '1px solid #fecaca',
                      background: '#fef2f2',
                      color: '#dc2626',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    标记为新
                  </button>
                )}
                {entry.status !== 'read' && (
                  <button
                    onClick={() => updateStatus(entry.id, 'read')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      border: '1px solid #fde68a',
                      background: '#fffbeb',
                      color: '#d97706',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    标记已读
                  </button>
                )}
                {entry.status !== 'resolved' && (
                  <button
                    onClick={() => updateStatus(entry.id, 'resolved')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      border: '1px solid #bbf7d0',
                      background: '#f0fdf4',
                      color: '#059669',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    标记已解决
                  </button>
                )}
                <button
                  onClick={() => deleteEntry(entry.id)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                    background: '#ffffff',
                    color: '#6b7280',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    marginLeft: 'auto',
                  }}
                >
                  🗑️ 删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
