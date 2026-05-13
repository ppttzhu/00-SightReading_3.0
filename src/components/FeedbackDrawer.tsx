import { useState, useEffect } from 'react';

interface FeedbackEntry {
  id: string;
  category: 'feature' | 'bug';
  nickname: string;
  content: string;
  status: 'new' | 'read' | 'resolved';
  timestamp: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

type SubmitState = 'idle' | 'loading' | 'success' | 'error';

function tabButtonStyle(active: boolean) {
  return {
    flex: 1,
    padding: '12px',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
    color: active ? '#3b82f6' : '#6b7280',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    fontSize: '0.9rem',
  } as const;
}

function categoryButtonStyle(category: 'feature' | 'bug', selected: 'feature' | 'bug' | null) {
  const active = selected === category;
  const isFeature = category === 'feature';
  return {
    flex: 1,
    padding: '10px 16px',
    borderRadius: '8px',
    border: active
      ? `2px solid ${isFeature ? '#3b82f6' : '#ef4444'}`
      : '2px solid #e5e7eb',
    background: active
      ? (isFeature ? '#eff6ff' : '#fef2f2')
      : '#ffffff',
    color: active
      ? (isFeature ? '#1d4ed8' : '#b91c1c')
      : '#6b7280',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.9rem',
  } as const;
}

export default function FeedbackDrawer({ open, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'submit' | 'resolved'>('submit');
  const [category, setCategory] = useState<'feature' | 'bug' | null>(null);
  const [nickname, setNickname] = useState('');
  const [content, setContent] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitError, setSubmitError] = useState('');
  const [resolvedEntries, setResolvedEntries] = useState<FeedbackEntry[]>([]);
  const [resolvedLoading, setResolvedLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setActiveTab('submit');
      setCategory(null);
      setNickname('');
      setContent('');
      setSubmitState('idle');
      setSubmitError('');
    }
  }, [open]);

  useEffect(() => {
    if (activeTab === 'resolved' && open && resolvedEntries.length === 0) {
      setResolvedLoading(true);
      fetch('/api/feedback/resolved')
        .then(res => res.json())
        .then(data => {
          setResolvedEntries(data.entries || []);
        })
        .catch(() => {
          setResolvedEntries([]);
        })
        .finally(() => {
          setResolvedLoading(false);
        });
    }
  }, [activeTab, open, resolvedEntries.length]);

  useEffect(() => {
    if (submitState === 'success' && open) {
      const timer = setTimeout(() => {
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [submitState, open, onClose]);

  const handleSubmit = async () => {
    if (!category || !content.trim()) return;

    setSubmitState('loading');
    setSubmitError('');

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          nickname: nickname.trim(),
          content: content.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitState('error');
        setSubmitError(data.error || '提交失败，请稍后重试');
        return;
      }

      setSubmitState('success');
    } catch {
      setSubmitState('error');
      setSubmitError('网络错误，请稍后重试');
    }
  };

  const isSubmitDisabled = !category || !content.trim() || submitState === 'loading' || submitState === 'success';

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 998,
            animation: 'fadeIn 0.2s ease',
          }}
        />
      )}

      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '100vw',
          height: '100vh',
          maxWidth: '400px',
          background: '#ffffff',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease',
          boxShadow: open ? '-4px 0 20px rgba(0,0,0,0.1)' : 'none',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 20px',
            borderBottom: '1px solid #e5e7eb',
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.2rem',
              cursor: 'pointer',
              padding: '4px',
              color: '#374151',
            }}
          >
            ←
          </button>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#111827' }}>
            意见反馈
          </h2>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #e5e7eb',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setActiveTab('submit')}
            style={tabButtonStyle(activeTab === 'submit')}
          >
            提交反馈
          </button>
          <button
            onClick={() => setActiveTab('resolved')}
            style={tabButtonStyle(activeTab === 'resolved')}
          >
            更新记录
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {activeTab === 'submit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Category */}
              <div>
                <label style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 500, display: 'block', marginBottom: '8px' }}>
                  反馈类型
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setCategory('feature')}
                    style={categoryButtonStyle('feature', category)}
                  >
                    ✨ 功能建议
                  </button>
                  <button
                    onClick={() => setCategory('bug')}
                    style={categoryButtonStyle('bug', category)}
                  >
                    🐛 Bug 反馈
                  </button>
                </div>
              </div>

              {/* Nickname */}
              <div>
                <label style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 500, display: 'block', marginBottom: '8px' }}>
                  昵称（可选）
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  placeholder="匿名用户"
                  maxLength={30}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Content */}
              <div>
                <label style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 500, display: 'block', marginBottom: '8px' }}>
                  反馈内容
                </label>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="请描述您遇到的问题或建议..."
                  maxLength={5000}
                  style={{
                    width: '100%',
                    minHeight: '120px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    outline: 'none',
                    fontFamily: 'system-ui, sans-serif',
                  }}
                />
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px', textAlign: 'right' }}>
                  {content.length} / 5000
                </div>
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={isSubmitDisabled}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: submitState === 'success' ? '#059669' : '#3b82f6',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
                  opacity: isSubmitDisabled && submitState !== 'success' ? 0.6 : 1,
                  transition: 'all 0.2s',
                }}
              >
                {submitState === 'loading' && '⏳ 提交中...'}
                {submitState === 'success' && '✅ 已提交！'}
                {submitState !== 'loading' && submitState !== 'success' && '提交反馈'}
              </button>

              {submitState === 'error' && submitError && (
                <p style={{ color: '#dc2626', fontSize: '0.85rem', margin: 0, textAlign: 'center' }}>
                  {submitError}
                </p>
              )}
            </div>
          )}

          {activeTab === 'resolved' && (
            <div>
              {resolvedLoading ? (
                <p style={{ textAlign: 'center', color: '#6b7280', padding: '40px 0' }}>加载中...</p>
              ) : resolvedEntries.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0' }}>
                  暂无已解决的反馈，敬请期待~
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {resolvedEntries.map(entry => (
                    <div
                      key={entry.id}
                      style={{
                        padding: '14px',
                        borderRadius: '8px',
                        background: '#f9fafb',
                        border: '1px solid #e5e7eb',
                      }}
                    >
                      <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '6px' }}>
                        {new Date(entry.timestamp).toLocaleString('zh-CN')}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#1f2937', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {entry.content}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '6px' }}>
                        — {entry.nickname}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}
