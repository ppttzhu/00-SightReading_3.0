import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../core/store/useAppStore';

const MODULE_LABELS: Record<string, string> = {
  notes: '单音',
  symbols: '音乐表情记号',
  theory: '双音/音程关系',
  patterns: '音型',
};

const MODULE_COLORS: Record<string, string> = {
  notes: '#3b82f6',
  symbols: '#ec4899',
  theory: '#8b5cf6',
  patterns: '#10b981',
};

export const NOTES_INPUT_MODE_KEY = 'notes_input_mode';

export default function StageSelector() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const [usePiano, setUsePiano] = useState(
    () => (localStorage.getItem(NOTES_INPUT_MODE_KEY) ?? 'piano') === 'piano'
  );

  const toggleMode = (val: boolean) => {
    setUsePiano(val);
    localStorage.setItem(NOTES_INPUT_MODE_KEY, val ? 'piano' : 'options');
  };

  // 从 Store 自动生成的关卡列表（包含自动+手动关卡）
  const getAllStages = useAppStore(state => state.getAllStages);

  const stages = getAllStages(moduleId || '');
  const moduleLabel = MODULE_LABELS[moduleId || ''] || moduleId;
  const moduleColor = MODULE_COLORS[moduleId || ''] || '#3b82f6';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <button
        onClick={() => navigate('/client')}
        style={{ alignSelf: 'flex-start', background: 'white', border: '1px solid #e5e7eb', padding: '8px 16px', borderRadius: '20px', fontSize: '1rem', cursor: 'pointer', color: '#6b7280', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
      >
        ← 返回主菜单
      </button>
      <h1 className="stage-selector-title" style={{ fontSize: '2.5rem', fontWeight: '800', color: '#111827', marginTop: '30px', letterSpacing: '-1px' }}>
        {moduleLabel} Trials
      </h1>

      {moduleId === 'notes' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '20px', padding: '6px 8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          {(['piano', 'options'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => toggleMode(mode === 'piano')}
              style={{
                padding: '6px 18px', borderRadius: '14px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem',
                background: (mode === 'piano') === usePiano ? moduleColor : 'transparent',
                color: (mode === 'piano') === usePiano ? 'white' : '#6b7280',
                transition: 'all 0.2s'
              }}
            >
              {mode === 'piano' ? '键盘' : '选项'}
            </button>
          ))}
        </div>
      )}

      {stages.length === 0 ? (
        <div style={{ marginTop: '100px', textAlign: 'center', color: '#9ca3af' }}>
          <div style={{ fontSize: '4rem', marginBottom: '20px', opacity: 0.3 }}>📭</div>
          <h2 style={{ fontWeight: '700', color: '#6b7280' }}>暂无可用关卡</h2>
          <p>请联系老师为该模块添加题目。</p>
        </div>
      ) : (
        <div className="stage-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '30px', marginTop: '60px', justifyContent: 'center', maxWidth: '800px' }}>
          {stages.map((stage, index) => {
            // TODO: revert after testing — restore: const isUnlocked = index < (useAppStore.getState().studentProgress[moduleId || ''] || 1);
            const isUnlocked = true;
            const stageNumber = index + 1;

            return (
              <div
                key={stage.id}
                onClick={() => isUnlocked ? navigate(`/client/quiz/${stage.id}`) : null}
                title={stage.title}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: isUnlocked ? 'pointer' : 'not-allowed',
                  transition: 'transform 0.2s ease'
                }}
                onMouseEnter={e => { if (isUnlocked) e.currentTarget.style.transform = 'scale(1.1)'; }}
                onMouseLeave={e => { if (isUnlocked) e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <div className="stage-circle" style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '50%',
                  background: isUnlocked ? 'white' : '#f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isUnlocked ? '2rem' : '1.5rem',
                  color: isUnlocked ? moduleColor : '#9ca3af',
                  fontWeight: '800',
                  boxShadow: isUnlocked ? `0 8px 24px ${moduleColor}26` : 'inset 0 2px 4px rgba(0,0,0,0.05)',
                  border: isUnlocked ? `2px solid ${moduleColor}50` : '1px solid #e5e7eb',
                }}>
                  {isUnlocked ? stageNumber : '🔒'}
                </div>
                <span style={{
                  fontSize: '0.85rem',
                  color: isUnlocked ? '#374151' : '#9ca3af',
                  fontWeight: '600',
                  whiteSpace: 'nowrap'
                }}>
                  {stage.title}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
