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

// Validate pitch input: letter A-G + digit 0-7
function isValidPitch(value: string): boolean {
  return /^[A-Ga-g][0-7]$/.test(value);
}

export default function StageSelector() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const [usePiano, setUsePiano] = useState(
    () => (localStorage.getItem(NOTES_INPUT_MODE_KEY) ?? 'options') === 'piano'
  );
  const [mode, setMode] = useState<'stages' | 'practice'>('stages');
  const [lowPitch, setLowPitch] = useState('C2');
  const [highPitch, setHighPitch] = useState('C6');

  const toggleMode = (val: boolean) => {
    setUsePiano(val);
    localStorage.setItem(NOTES_INPUT_MODE_KEY, val ? 'piano' : 'options');
  };

  // 从 Store 自动生成的关卡列表（包含自动+手动关卡）
  const getAllStages = useAppStore(state => state.getAllStages);

  const stages = getAllStages(moduleId || '');
  const moduleLabel = MODULE_LABELS[moduleId || ''] || moduleId;
  const moduleColor = MODULE_COLORS[moduleId || ''] || '#3b82f6';

  const isNotesModule = moduleId === 'notes';
  const canStartPractice = isValidPitch(lowPitch) && isValidPitch(highPitch);

  const handleStartPractice = () => {
    if (!canStartPractice) return;
    const low = lowPitch.charAt(0).toUpperCase() + lowPitch.charAt(1);
    const high = highPitch.charAt(0).toUpperCase() + highPitch.charAt(1);
    navigate(`/client/practice/notes?low=${low}&high=${high}`);
  };

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

      {isNotesModule && (
        <>
          {/* Mode toggle: 练习 / 闯关 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '20px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '20px', padding: '6px 8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            {([{ key: 'practice', label: '练习模式' }, { key: 'stages', label: '闯关模式' }] as const).map(m => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                style={{
                  padding: '8px 22px', borderRadius: '14px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '0.95rem',
                  background: mode === m.key ? moduleColor : 'transparent',
                  color: mode === m.key ? 'white' : '#6b7280',
                  transition: 'all 0.2s'
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Input mode toggle (keyboard vs options) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '20px', padding: '6px 8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            {(['piano', 'options'] as const).map(inputMode => (
              <button
                key={inputMode}
                onClick={() => toggleMode(inputMode === 'piano')}
                style={{
                  padding: '6px 18px', borderRadius: '14px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem',
                  background: (inputMode === 'piano') === usePiano ? moduleColor : 'transparent',
                  color: (inputMode === 'piano') === usePiano ? 'white' : '#6b7280',
                  transition: 'all 0.2s'
                }}
              >
                {inputMode === 'piano' ? '键盘' : '选项'}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Practice mode UI */}
      {isNotesModule && mode === 'practice' && (
        <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <p style={{ color: '#6b7280', fontSize: '0.95rem', textAlign: 'center', maxWidth: '400px' }}>
            设置音域范围，系统将在该范围内随机生成单音练习题，无限循环。
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: '600' }}>最低音</label>
              <input
                type="text"
                value={lowPitch}
                onChange={(e) => setLowPitch(e.target.value.slice(0, 2))}
                maxLength={2}
                placeholder="C2"
                style={{
                  width: '80px', textAlign: 'center', padding: '12px', borderRadius: '12px',
                  border: isValidPitch(lowPitch) ? '2px solid #d1d5db' : '2px solid #f87171',
                  fontSize: '1.4rem', fontWeight: '700', fontFamily: 'monospace',
                  outline: 'none', transition: 'border-color 0.2s'
                }}
              />
            </div>
            <span style={{ fontSize: '1.5rem', color: '#9ca3af', fontWeight: '300' }}>—</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: '600' }}>最高音</label>
              <input
                type="text"
                value={highPitch}
                onChange={(e) => setHighPitch(e.target.value.slice(0, 2))}
                maxLength={2}
                placeholder="C6"
                style={{
                  width: '80px', textAlign: 'center', padding: '12px', borderRadius: '12px',
                  border: isValidPitch(highPitch) ? '2px solid #d1d5db' : '2px solid #f87171',
                  fontSize: '1.4rem', fontWeight: '700', fontFamily: 'monospace',
                  outline: 'none', transition: 'border-color 0.2s'
                }}
              />
            </div>
          </div>
          {(!isValidPitch(lowPitch) || !isValidPitch(highPitch)) && (
            <p style={{ color: '#f87171', fontSize: '0.8rem' }}>格式：字母(A-G) + 数字(0-7)，如 C2、G5</p>
          )}
          <button
            onClick={handleStartPractice}
            disabled={!canStartPractice}
            style={{
              marginTop: '10px', padding: '14px 40px', borderRadius: '24px', border: 'none',
              background: canStartPractice ? moduleColor : '#94a3b8',
              color: 'white', fontSize: '1.1rem', fontWeight: '700',
              cursor: canStartPractice ? 'pointer' : 'not-allowed',
              boxShadow: canStartPractice ? `0 8px 24px ${moduleColor}40` : 'none',
              transition: 'all 0.2s'
            }}
          >
            🎵 开始练习
          </button>
        </div>
      )}

      {/* Stages mode UI (existing) */}
      {(!isNotesModule || mode === 'stages') && (
        <>
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
        </>
      )}
    </div>
  );
}
