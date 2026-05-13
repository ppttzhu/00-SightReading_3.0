import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music, Hash, LibraryBig, Activity } from 'lucide-react';

const modules = [
  { id: 'notes', label: '音符', title: 'Notes', color: '#3b82f6', bg: '#eff6ff', icon: <Music size={48} color="#3b82f6" strokeWidth={1.5} />, hint: '识别五线谱上的音名，建立读谱基础。适合零基础学员。单关约 3-5 分钟。' },
  { id: 'symbols', label: '符号', title: 'Symbols', color: '#ec4899', bg: '#fdf2f8', icon: <Hash size={48} color="#ec4899" strokeWidth={1.5} />, hint: '认识各种音乐符号与记号，提升乐谱阅读能力。适合已掌握音符的学员。' },
  { id: 'theory', label: '乐理', title: 'Theory', color: '#8b5cf6', bg: '#f5f3ff', icon: <LibraryBig size={48} color="#8b5cf6" strokeWidth={1.5} />, hint: '理解音程、调式、和弦等基础乐理知识。适合进阶学员。' },
  { id: 'patterns', label: '节奏型', title: 'Patterns', color: '#10b981', bg: '#ecfdf5', icon: <Activity size={48} color="#10b981" strokeWidth={1.5} />, hint: '练习不同节奏型的识别与拍感。适合有一定基础的学员。' },
];

export default function MainMenu() {
  const navigate = useNavigate();
  const [activeHint, setActiveHint] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '20px' }}>
      <h1 style={{ fontSize: '3rem', fontWeight: '800', color: '#111827', marginBottom: '60px', letterSpacing: '-1px' }} className="main-menu-title">
        选择练习项目
      </h1>
      <div className="main-menu-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '40px', maxWidth: '800px', width: '100%' }}>
        {modules.map(m => (
          <div
            key={m.id}
            className="main-menu-card"
            onClick={() => navigate(`/client/module/${m.id}`)}
            style={{
              background: 'white',
              borderRadius: '32px',
              padding: '40px 30px',
              textAlign: 'center',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              border: '1px solid #f3f4f6',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-8px)';
              e.currentTarget.style.boxShadow = `0 20px 40px ${m.color}15`;
              e.currentTarget.style.borderColor = `${m.color}30`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.03)';
              e.currentTarget.style.borderColor = '#f3f4f6';
            }}
          >
            {/* Hint button */}
            <div
              className="hint-wrapper"
              style={{ position: 'absolute', top: '8px', right: '8px' }}
              onMouseEnter={() => setActiveHint(m.id)}
              onMouseLeave={() => setActiveHint(null)}
            >
              <div
                className="hint-button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveHint(activeHint === m.id ? null : m.id);
                }}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  border: `1.5px solid ${m.color}40`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  color: m.color,
                  fontWeight: '600',
                  cursor: 'help',
                  background: 'white',
                }}
              >
                ⓘ
              </div>
              {activeHint === m.id && (
                <div
                  className="hint-tooltip"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: '0',
                    width: '220px',
                    background: 'white',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                    border: '1px solid #f3f4f6',
                    fontSize: '14px',
                    lineHeight: 1.6,
                    color: '#4b5563',
                    zIndex: 100,
                    textAlign: 'left',
                  }}
                >
                  {m.hint}
                </div>
              )}
            </div>

            <div className="main-menu-icon" style={{
              width: '100px',
              height: '100px',
              borderRadius: '28px',
              background: m.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '24px'
            }}>
              {m.icon}
            </div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '700', color: '#1f2937', margin: 0, letterSpacing: '-0.5px' }}>{m.label}</h2>
            <span style={{ fontSize: '1rem', color: '#9ca3af', fontWeight: '500', marginTop: '4px' }}>{m.title}</span>
            {activeHint === m.id && (
              <div className="hint-inline" style={{ marginTop: '12px', padding: '10px 14px', background: '#f9fafb', borderRadius: '10px', fontSize: '13px', lineHeight: 1.5, color: '#4b5563', textAlign: 'left', width: '100%' }}>
                {m.hint}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
