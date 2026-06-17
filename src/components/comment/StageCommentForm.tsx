import { useState, useRef } from 'react';

interface Props {
  placeholder?: string;
  maxLength?: number;
  onSubmit: (content: string) => Promise<boolean>;
  onCancel?: () => void;
}

export default function StageCommentForm({ placeholder = '写点什么吧...', maxLength = 500, onSubmit, onCancel }: Props) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const trimmed = content.trim();
  const canSubmit = trimmed.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const ok = await onSubmit(trimmed);
    setSubmitting(false);
    if (ok) {
      setContent('');
      inputRef.current?.blur();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <textarea
        ref={inputRef}
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={2}
        style={{
          width: '100%',
          padding: '8px 12px',
          fontSize: '0.85rem',
          border: '1px solid #d1d5db',
          borderRadius: '10px',
          outline: 'none',
          resize: 'none',
          fontFamily: 'inherit',
          lineHeight: 1.5,
          boxSizing: 'border-box',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; }}
        onBlur={e => { e.currentTarget.style.borderColor = '#d1d5db'; }}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', color: content.length > maxLength * 0.9 ? '#dc2626' : '#9ca3af' }}>
          {content.length}/{maxLength}
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          {onCancel && (
            <button
              onClick={onCancel}
              style={{
                padding: '6px 16px', borderRadius: '8px', border: '1px solid #d1d5db',
                background: 'white', color: '#6b7280', fontSize: '0.82rem', fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              取消
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              padding: '6px 16px', borderRadius: '8px', border: 'none',
              background: canSubmit ? '#3b82f6' : '#e5e7eb',
              color: canSubmit ? 'white' : '#9ca3af',
              fontSize: '0.82rem', fontWeight: 600, cursor: canSubmit ? 'pointer' : 'default',
              transition: 'background 0.15s ease',
            }}
          >
            {submitting ? '提交中...' : '提交'}
          </button>
        </div>
      </div>
    </div>
  );
}
