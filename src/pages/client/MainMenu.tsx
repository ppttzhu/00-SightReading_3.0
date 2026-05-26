import { useNavigate } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { Compass, Dumbbell, Route } from 'lucide-react';

const entryCards = [
  {
    title: '主线闯关',
    subtitle: 'Adventure',
    detail: '跟着老师编好的路线，一关一关解锁新内容。',
    action: '/client/adventure',
    color: '#2563eb',
    bg: '#eff6ff',
    icon: Route,
  },
  {
    title: '自由练习',
    subtitle: 'Free Practice',
    detail: '自己选择单音、双音、符号或音型，随时补练。',
    action: '/client/free',
    color: '#059669',
    bg: '#ecfdf5',
    icon: Dumbbell,
  },
];

export default function MainMenu() {
  const navigate = useNavigate();

  return (
    <div className="learning-home">
      <div className="learning-home-heading">
        <span><Compass size={18} /> Sight-Reading Path</span>
        <h1>今天从哪里开始？</h1>
      </div>

      <div className="learning-entry-grid">
        {entryCards.map(card => {
          const Icon = card.icon;
          return (
            <button
              key={card.action}
              className="learning-entry-card"
              onClick={() => navigate(card.action)}
              style={{ '--entry-color': card.color, '--entry-bg': card.bg } as CSSProperties}
            >
              <span className="learning-entry-icon"><Icon size={48} /></span>
              <span className="learning-entry-copy">
                <strong>{card.title}</strong>
                <small>{card.subtitle}</small>
                <em>{card.detail}</em>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
