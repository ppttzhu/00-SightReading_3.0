import { useNavigate } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { Activity, Hash, LibraryBig, Music, SlidersHorizontal, Guitar } from 'lucide-react';

const freeModules = [
  {
    id: 'notes',
    title: '单音自由练习',
    label: 'Notes',
    detail: '按默认音域快速开始，进阶参数仍在单音模块里保留。',
    color: '#2563eb',
    bg: '#eff6ff',
    icon: Music,
    action: '/client/practice/notes?low=C2&high=C6',
  },
  {
    id: 'theory',
    title: '双音/音程自由练习',
    label: 'Interval',
    detail: '随机生成音程题，适合短时间集中辨认。',
    color: '#7c3aed',
    bg: '#f5f3ff',
    icon: LibraryBig,
    action: '/client/practice/intervals',
  },
  {
    id: 'chords',
    title: '和弦识别练习',
    label: 'Chord',
    detail: '从老师出好的和弦题库中随机抽题，认出和弦名。',
    color: '#d97706',
    bg: '#fffbeb',
    icon: Guitar,
    action: '/client/free/patterns',  // 和弦题存在 patterns 模块
  },
  {
    id: 'symbols',
    title: '符号题库',
    label: 'Symbols',
    detail: '先进入现有关卡页，后续再扩展随机刷题。',
    color: '#db2777',
    bg: '#fdf2f8',
    icon: Hash,
    action: '/client/free/symbols',
  },
  {
    id: 'patterns',
    title: '音型题库',
    label: 'Patterns',
    detail: '传统音型 + 和弦识别题目均在此模块。',
    color: '#059669',
    bg: '#ecfdf5',
    icon: Activity,
    action: '/client/free/patterns',
  },
];

export default function FreePracticeHub() {
  const navigate = useNavigate();

  return (
    <div className="free-page">
      <div className="free-header">
        <button className="client-soft-button" onClick={() => navigate('/client')}>
          返回首页
        </button>
        <div>
          <span className="free-kicker"><SlidersHorizontal size={16} /> 自由练习</span>
          <h1>自己选择今天要练的内容</h1>
          <p>自由练习用来查漏补缺；主线闯关负责安排学习顺序。</p>
        </div>
      </div>

      <div className="free-grid">
        {freeModules.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className="free-card"
              onClick={() => navigate(item.action)}
              style={{ '--module-color': item.color, '--module-bg': item.bg } as CSSProperties}
            >
              <span className="free-icon"><Icon size={34} /></span>
              <span className="free-card-body">
                <strong>{item.title}</strong>
                <small>{item.label}</small>
                <em>{item.detail}</em>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
