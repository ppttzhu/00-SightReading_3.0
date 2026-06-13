import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { Check, Loader2, Lock, Music2, Play, RefreshCw, Route, Trophy } from 'lucide-react';
import { useAppStore } from '../../core/store/useAppStore';
import { useAuth } from '../../core/auth/AuthProvider';
import { supabase } from '../../core/auth/supabaseClient';
import { FREE_TRIAL_LIMIT } from './constants';

const pathColors = ['#2563eb', '#0891b2', '#7c3aed', '#16a34a', '#ea580c', '#d946ef', '#f59e0b', '#06b6d4', '#84cc16', '#6366f1'];

interface CompletionInfo {
  attemptCount: number;
  bestScore: number;
  passed: boolean;
  stageVersion?: number;
}

export default function AdventureMap() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAnonymous = !user;
  const slicesPool = useAppStore(s => s.slicesPool);
  const customStages = useAppStore(s => s.customStages);
  const adventureStages = useAppStore(s => s.adventureStages);
  const stageOrder = useAppStore(s => s.stageOrder);
  const getAdventureStages = useAppStore(s => s.getAdventureStages);
  const completedIds = useAppStore(s => s.adventureCompletedStageIds);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completions, setCompletions] = useState<Map<string, CompletionInfo>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // Load completions data from Supabase
      if (supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session && !cancelled) {
          const { data } = await supabase
            .from('adventure_stage_completions')
            .select('stage_id, score, attempt_count, passed, stage_version');
          if (data && !cancelled) {
            const map = new Map<string, CompletionInfo>();
            for (const row of data as any[]) {
              const existing = map.get(row.stage_id);
              if (!existing || (row.score ?? 0) > existing.bestScore) {
                map.set(row.stage_id, {
                  attemptCount: row.attempt_count ?? 1,
                  bestScore: row.score ?? 0,
                  passed: row.passed ?? true,
                  stageVersion: row.stage_version ?? undefined,
                });
              }
            }
            setCompletions(map);
          }
        }
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const stages = useMemo(
    () => getAdventureStages(),
    [getAdventureStages, slicesPool, customStages, stageOrder, adventureStages],
  );

  const totalLevels = stages.length;
  const completedCount = stages.filter(s => completedIds.includes(s.id)).length;

  const renderPassCriteria = useCallback((stage: typeof stages[number]) => {
    if (!stage.passCriteria?.enabled) return null;
    return (
      <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: '#fef2f2', color: '#dc2626', fontWeight: 600, marginLeft: '6px' }}>
        需 ≥{stage.passCriteria.minAccuracy}%
      </span>
    );
  }, []);

  const renderCompletionStats = useCallback((stageId: string, isCompleted: boolean) => {
    const info = completions.get(stageId);
    if (!info) return null;
    if (isCompleted) {
      return (
        <small style={{ display: 'block', color: '#059669', fontWeight: 600, marginTop: '2px', fontSize: '0.75rem' }}>
          最高正确率 {info.bestScore}%
        </small>
      );
    }
    return (
      <small style={{ display: 'block', color: '#d97706', fontWeight: 600, marginTop: '2px', fontSize: '0.75rem' }}>
        已试 {info.attemptCount} 次 · 最高 {info.bestScore}%
      </small>
    );
  }, [completions]);

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

      {/* ── 未注册提示 ── */}
      {isAnonymous && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', background: '#fef3c7', border: '1px solid #fde68a', margin: '0 0 16px' }}>
          <Lock size={16} style={{ color: '#d97706', flexShrink: 0 }} />
          <span style={{ fontSize: '0.875rem', color: '#92400e' }}>
            未注册用户仅可体验前 {FREE_TRIAL_LIMIT} 关。<button onClick={() => navigate('/auth')} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 600, cursor: 'pointer', padding: 0 }}>注册</button> 后解锁全部关卡。
          </span>
        </div>
      )}

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
            const isTrialLocked = isAnonymous && index >= FREE_TRIAL_LIMIT;
            const canPlay = isUnlocked && stage.slices.length > 0 && !isTrialLocked;
            const hasAttempts = completions.has(stageId);
            const status = isTrialLocked ? 'locked' : isCompleted ? 'complete' : canPlay ? 'ready' : 'locked';
            const completionInfo = completions.get(stageId);
            const isUpdated = isCompleted && stage.stageVersion != null
              && (completionInfo?.stageVersion ?? 0) < stage.stageVersion;
            const tone = pathColors[index % pathColors.length];

            const actionLabel = isTrialLocked ? '需注册' : canPlay ? (isCompleted ? '复习' : hasAttempts ? '继续挑战' : '闯关') : '锁定';

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
                  <strong>
                    {stage.title}
                    {!isCompleted && renderPassCriteria(stage)}
                    {isUpdated && (
                      <span style={{ fontSize: '0.7rem', padding: '1px 7px', borderRadius: '4px', background: '#fff7ed', color: '#ea580c', fontWeight: 700, marginLeft: '6px', verticalAlign: 'middle' }}>
                        已更新
                      </span>
                    )}
                  </strong>
                  <small className={stage.description ? 'quest-desc' : 'quest-placeholder'}>
                    {stage.description || '暂无描述'}
                  </small>
                  {renderCompletionStats(stageId, isCompleted)}
                  {isCompleted && stage.passCriteria?.enabled && (
                    <small style={{ display: 'block', color: '#9ca3af', marginTop: '2px', fontSize: '0.7rem' }}>
                      通关要求 ≥{stage.passCriteria.minAccuracy}%
                    </small>
                  )}
                </span>
                <span className="quest-action">
                  {actionLabel}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
