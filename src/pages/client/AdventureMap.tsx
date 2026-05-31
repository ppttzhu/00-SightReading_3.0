import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { Check, Loader2, Lock, Music2, Play, RefreshCw, Route, Trophy } from 'lucide-react';
import { useAppStore } from '../../core/store/useAppStore';

const pathColors = ['#2563eb', '#0891b2', '#7c3aed', '#16a34a', '#ea580c', '#d946ef', '#f59e0b', '#06b6d4', '#84cc16', '#6366f1'];

export default function AdventureMap() {
  const navigate = useNavigate();
  const slicesPool = useAppStore(s => s.slicesPool);
  const customStages = useAppStore(s => s.customStages);
  const adventureStages = useAppStore(s => s.adventureStages);
  const stageOrder = useAppStore(s => s.stageOrder);
  const getAdventureStages = useAppStore(s => s.getAdventureStages);
  const completedIds = useAppStore(s => s.adventureCompletedStageIds);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // simulate brief data resolution; in production this waits for provider.load()
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  const stages = useMemo(
    () => getAdventureStages(),
    [getAdventureStages, slicesPool, customStages, stageOrder, adventureStages],
  );

  const totalLevels = stages.length;
  const completedCount = stages.filter(s => completedIds.includes(s.id)).length;

  // ── 加载态 ──
  if (loading) {
    return (
      <div className="adventure-game-page" style={{ alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <Loader2 size={40} className="spin-icon" />
        <p style={{ color: '#94a3b8', marginTop: 16 }}>加载冒险路线...</p>
      </div>
    );
  }

  // ── 错误态 ──
  if (error) {
    return (
      <div className="adventure-game-page" style={{ alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <p style={{ color: '#dc2626', fontSize: '1rem' }}>{error}</p>
        <button
          className="client-soft-button"
          onClick={() => { setError(null); setLoading(true); setTimeout(() => setLoading(false), 300); }}
          style={{ marginTop: 12 }}
        >
          <RefreshCw size={16} /> 重试
        </button>
        <button className="client-soft-button" onClick={() => navigate('/client')} style={{ marginTop: 8 }}>
          返回首页
        </button>
      </div>
    );
  }

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

      {/* ── 空状态 ── */}
      {stages.length === 0 && (
        <div className="adventure-empty">
          <Music2 size={22} />
          <span>老师还没有配置闯关路线，先去自由练习吧。</span>
          <button className="client-soft-button" onClick={() => navigate('/client/free')} style={{ marginLeft: 'auto' }}>
            去自由练习
          </button>
        </div>
      )}

      {/* ── 关卡路线 ── */}
      {stages.length > 0 && (
        <div className="adventure-quest-board">
          {stages.map((stage, index) => {
            const stageId = stage.id;
            const isCompleted = completedIds.includes(stageId);
            const prevId = index > 0 ? stages[index - 1].id : null;
            const isUnlocked = index === 0 || (prevId ? completedIds.includes(prevId) : false);
            const canPlay = isUnlocked && !isCompleted && stage.slices.length > 0;
            const status = isCompleted ? 'complete' : canPlay ? 'ready' : 'locked';
            const tone = pathColors[index % pathColors.length];

            return (
              <button
                key={stageId}
                className={`adventure-quest-card ${status}`}
                disabled={!canPlay}
                onClick={() => navigate(`/client/adventure/quiz/${stageId}`)}
                style={{ '--node-color': tone } as CSSProperties}
              >
                <span className="quest-rail">
                  <span className="quest-orb">
                    {isCompleted ? <Check size={30} /> : canPlay ? <Play size={30} /> : <Lock size={25} />}
                  </span>
                </span>
                <span className="quest-card-body">
                  <strong>{stage.title}</strong>
                  <small className={stage.description ? 'quest-desc' : 'quest-placeholder'}>
                    {stage.description || '等待解锁'}
                  </small>
                </span>
                <span className="quest-action">
                  {canPlay ? '闯关' : isCompleted ? '复习' : '锁定'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
