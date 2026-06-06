import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import type { GuidanceImage } from '../core/store/useAppStore';

interface Props {
  title: string;
  guidance: string;
  guidanceImages?: GuidanceImage[];
  onStart: () => void;
  buttonText?: string;
}

/** 预处理 guidance 文本：将 {image:id} 占位符替换为真实 URL */
function preprocessGuidance(text: string, images: GuidanceImage[]): string {
  return text.replace(/\{image:([a-z0-9_]+)\}/g, (_match, id) => {
    const found = images.find(img => img.id === id);
    return found?.url ?? _match;
  });
}

export default function GuidanceModal({ title, guidance, guidanceImages = [], onStart, buttonText = '开始答题' }: Props) {
  const resolvedGuidance = preprocessGuidance(guidance, guidanceImages);
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
            remarkPlugins={[remarkGfm, remarkBreaks]}
            components={{
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
              ),
              img: ({ src, alt }) => (
                <img
                  src={src}
                  alt={alt ?? ''}
                  style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', display: 'block', margin: '8px 0' }}
                />
              ),
            }}
          >
            {resolvedGuidance}
          </ReactMarkdown>
        </div>

        <div
          style={{
            display: 'flex', justifyContent: 'center',
            padding: '16px 28px 24px',
            borderTop: '1px solid #f3f4f6',
          }}
        >
          <button
            onClick={onStart}
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
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}
