import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { Check, Flag, Lock, Music2, Play, Route, Star, Trophy } from 'lucide-react';
import { useAppStore } from '../../core/store/useAppStore';

const pathTemplate = [
  { level: 1, title: '坐标单音', subtitle: '先找到最稳定的读谱坐标', tone: '#2563eb' },
  { level: 2, title: '邻近单音', subtitle: '围绕坐标音做上行和下行', tone: '#0891b2' },
  { level: 3, title: '双音入门', subtitle: '开始识别两个音之间的关系', tone: '#7c3aed' },
  { level: 4, title: '单音与双音混合', subtitle: '把两种能力放在同一轮里', tone: '#16a34a' },
  { level: 5, title: '综合复习', subtitle: '把近期内容串成完整路线', tone: '#ea580c' },
];

export default function AdventureMap() {
  const navigate = useNavigate();
  const slicesPool = useAppStore(state => state.slicesPool);
  const customStages = useAppStore(state => state.customStages);
  const adventureStages = useAppStore(state => state.adventureStages);
  const stageOrder = useAppStore(state => state.stageOrder);
  const getAdventureStages = useAppStore(state => state.getAdventureStages);
  const unlocked = useAppStore(state => state.studentProgress.adventure || 1);
  const stages = useMemo(
    () => getAdventureStages(),
    [getAdventureStages, slicesPool, customStages, stageOrder, adventureStages],
  );
  const stageByLevel = new Map(stages.map((stage, index) => [index + 1, stage]));
  const totalLevels = adventureStages.length > 0 ? Math.max(stages.length, adventureStages.length) : pathTemplate.length;
  const pathItems = Array.from({ length: totalLevels }, (_, index) => {
    const level = index + 1;
    const template = pathTemplate[index % pathTemplate.length];
    const stage = stageByLevel.get(level);
    return {
      ...template,
      level,
      title: stage?.title.replace(/^Lv\.\d+\s*/i, '') || template.title,
    };
  });
  const completedCount = Math.min(Math.max(unlocked - 1, 0), totalLevels);

  return (
    <div className="adventure-game-page">
      <div className="adventure-game-hero">
        <div className="adventure-game-copy">
          <button className="client-soft-button" onClick={() => navigate('/client')}>
            返回首页
          </button>
          <span className="adventure-kicker"><Route size={16} /> 主线闯关</span>
          <h1>闯关地图</h1>
          <p>沿着老师排好的关卡路线前进。点亮当前关，完成后自动解锁下一关。</p>
        </div>
        <div className="adventure-game-progress">
          <div className="adventure-progress-medal">
            <Trophy size={28} />
          </div>
          <div>
            <strong>{completedCount}/{totalLevels}</strong>
            <span>已完成关卡</span>
            <div className="adventure-game-progress-bar">
              <div style={{ width: `${totalLevels > 0 ? (completedCount / totalLevels) * 100 : 0}%` }} />
            </div>
          </div>
        </div>
      </div>

      {stages.length === 0 && (
        <div className="adventure-empty">
          <Music2 size={22} />
          <span>还没有可用主线。学生端会先显示地图框架，等老师在教师端把现有关卡排成路线后即可开始闯关。</span>
        </div>
      )}

      <div className="adventure-quest-board">
        {pathItems.map((item) => {
          const stage = stageByLevel.get(item.level);
          const isUnlocked = item.level <= unlocked;
          const isCompleted = item.level < unlocked && Boolean(stage);
          const canPlay = isUnlocked && stage !== undefined && stage.slices.length > 0;
          const isFinal = item.level === totalLevels;
          const status = isCompleted ? 'complete' : canPlay ? 'ready' : 'locked';

          return (
            <button
              key={item.level}
              className={`adventure-quest-card ${status}`}
              disabled={!canPlay}
              onClick={() => stage && navigate(`/client/adventure/quiz/${stage.id}`)}
              style={{ '--node-color': item.tone } as CSSProperties}
            >
              <span className="quest-rail">
                <span className="quest-orb">
                  {isCompleted ? <Check size={30} /> : canPlay ? <Play size={30} /> : <Lock size={25} />}
                </span>
              </span>
              <span className="quest-card-body">
                <span className="quest-card-topline">
                  <span className="level-chip">{isCompleted ? <Star size={13} /> : isFinal ? <Flag size={13} /> : `Lv.${item.level}`}</span>
                  <span className="quest-status-text">
                    {isCompleted ? '已完成' : canPlay ? '当前可闯关' : '等待解锁'}
                  </span>
                </span>
                <strong>{item.title}</strong>
                <small>{stage ? `${stage.slices.length}/${stage.questionCount} 题 · ${item.subtitle}` : '等待老师配置主线 · ' + item.subtitle}</small>
              </span>
              <span className="quest-action">
                {canPlay ? '开始' : isCompleted ? '复习' : '锁定'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
