import { useNavigate } from 'react-router-dom';
import { Music, Hash, LibraryBig, Activity } from 'lucide-react';
import TrainingLeaderboardButtons from '../../components/TrainingLeaderboardButtons';

const modules = [
  { id: 'notes', label: '单音', title: 'Notes', color: '#3b82f6', bg: '#eff6ff', icon: <Music size={48} color="#3b82f6" strokeWidth={1.5} /> },
  { id: 'symbols', label: '音乐表情记号', title: 'Symbols', color: '#ec4899', bg: '#fdf2f8', icon: <Hash size={48} color="#ec4899" strokeWidth={1.5} /> },
  { id: 'theory', label: '双音/音程关系', title: 'Interval', color: '#8b5cf6', bg: '#f5f3ff', icon: <LibraryBig size={48} color="#8b5cf6" strokeWidth={1.5} /> },
  { id: 'patterns', label: '音型', title: 'Patterns', color: '#10b981', bg: '#ecfdf5', icon: <Activity size={48} color="#10b981" strokeWidth={1.5} /> },
];

export default function MainMenu() {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '20px' }}>
      <TrainingLeaderboardButtons>
        <h1 style={{ fontSize: '3rem', fontWeight: '800', color: '#111827', marginBottom: '60px', letterSpacing: '-1px', marginTop: 0 }} className="main-menu-title">
          Select Your Trial
        </h1>
      </TrainingLeaderboardButtons>
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
            <h2 style={{ fontSize: '1.8rem', fontWeight: '700', color: '#1f2937', margin: 0, letterSpacing: '-0.5px' }}>{m.title}</h2>
            <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '400', fontFamily: "'Noto Serif SC', 'STSong', 'SimSun', serif", letterSpacing: '2px', marginTop: '6px' }}>{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
