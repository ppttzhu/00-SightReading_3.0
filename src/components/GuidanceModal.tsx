import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  title: string;
  guidance: string;
  onStart: (dontShowAgain: boolean) => void;
}

export default function GuidanceModal({ title, guidance, onStart }: Props) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  return (
    <div
      data-testid="guidance-backdrop"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '12px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: '16px',
          width: '100%', maxWidth: '640px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        <div style={{ padding: '24px 28px 8px' }}>
          <div style={{ fontSize: '0.78rem', color: '#9ca3af', letterSpacing: '0.05em' }}>
            📖 学习指导
          </div>
          <h2 style={{ margin: '4px 0 0', fontSize: '1.25rem', color: '#1f2937', fontWeight: 800 }}>
            {title}
          </h2>
        </div>

        <div
          className="guidance-body"
          style={{
            padding: '12px 28px',
            overflowY: 'auto',
            color: '#374151',
            fontSize: '1rem',
            lineHeight: 1.7,
            flex: 1,
          }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
              ),
            }}
          >
            {guidance}
          </ReactMarkdown>
        </div>

        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '12px', padding: '16px 28px 24px',
            borderTop: '1px solid #f3f4f6', flexWrap: 'wrap',
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#6b7280', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            不再提示此关卡
          </label>
          <button
            onClick={() => onStart(dontShowAgain)}
            style={{
              padding: '12px 28px',
              minHeight: '48px',
              borderRadius: '12px', border: 'none',
              background: '#3b82f6', color: 'white',
              fontWeight: 700, fontSize: '1rem',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(59,130,246,0.35)',
            }}
          >
            开始答题
          </button>
        </div>
      </div>
    </div>
  );
}
