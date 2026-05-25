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
  const [includeSharps, setIncludeSharps] = useState(false);
  const [includeFlats, setIncludeFlats] = useState(false);

  // Theory practice params
  const [intervalType, setIntervalType] = useState('随机');
  const [intervalDirection, setIntervalDirection] = useState('随机');
  const [intervalClef, setIntervalClef] = useState('自动');
  const [intervalMode, setIntervalMode] = useState('随机');

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
  const isTheoryModule = moduleId === 'theory';
  const canStartPractice = isValidPitch(lowPitch) && isValidPitch(highPitch);

  const handleStartPractice = () => {
    if (!canStartPractice) return;
    const low = lowPitch.charAt(0).toUpperCase() + lowPitch.charAt(1);
    const high = highPitch.charAt(0).toUpperCase() + highPitch.charAt(1);
    const sharp = includeSharps ? '&sharp=1' : '';
    const flat = includeFlats ? '&flat=1' : '';
    navigate(`/client/practice/notes?low=${low}&high=${high}${sharp}${flat}`);
  };

  const handleStartTheoryPractice = () => {
    navigate(`/client/practice/intervals?type=${intervalType}&direction=${intervalDirection}&clef=${intervalClef}&mode=${intervalMode}`);
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

      {(isNotesModule || isTheoryModule) && (
        <>
          {/* Mode toggle: 练习 / 闯关 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '20px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '20px', padding: '6px 8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            {([{ key: 'stages', label: '闯关模式' }, { key: 'practice', label: '练习模式' }] as const).map(m => (
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

          {/* Input mode toggle (keyboard vs options) — only for Notes */}
          {isNotesModule && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '20px', padding: '6px 8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              {(['options', 'piano'] as const).map(inputMode => (
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
          )}
        </>
      )}

      {/* Notes practice mode UI */}
      {isNotesModule && mode === 'practice' && (
        <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <p style={{ color: '#6b7280', fontSize: '0.95rem', textAlign: 'center', maxWidth: '400px', margin: '0', padding: '2px 0' }}>
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
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#374151', fontSize: '0.95rem', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={includeSharps}
                onChange={(e) => setIncludeSharps(e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              包含升号 (♯)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#374151', fontSize: '0.95rem', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={includeFlats}
                onChange={(e) => setIncludeFlats(e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              包含降号 (♭)
            </label>
          </div>
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

      {/* Theory practice mode UI */}
      {isTheoryModule && mode === 'practice' && (
        <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <p style={{ color: '#6b7280', fontSize: '0.95rem', textAlign: 'center', maxWidth: '400px' }}>
            系统将按所选规则随机生成音程练习题，无限循环。
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center' }}>
            {([
              { label: '音程类型', value: intervalType, setter: setIntervalType, options: ['随机', '一度', '二度', '三度', '四度', '五度', '六度', '七度', '八度'] },
              { label: '方向', value: intervalDirection, setter: setIntervalDirection, options: ['随机', '上行', '下行'] },
              { label: '谱号', value: intervalClef, setter: setIntervalClef, options: ['自动', '高音谱号', '低音谱号'] },
              { label: '音程模式', value: intervalMode, setter: setIntervalMode, options: ['随机', '旋律音程', '和声音程'] },
            ] as const).map(({ label, value, setter, options }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: '600' }}>{label}</label>
                <select
                  value={value}
                  onChange={e => setter(e.target.value as never)}
                  style={{
                    padding: '10px 14px', borderRadius: '12px', border: '2px solid #e5e7eb',
                    fontSize: '0.95rem', fontWeight: '600', color: '#374151',
                    background: 'white', cursor: 'pointer', outline: 'none',
                    appearance: 'none', paddingRight: '28px',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
                  }}
                >
                  {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
          <button
            onClick={handleStartTheoryPractice}
            style={{
              marginTop: '10px', padding: '14px 40px', borderRadius: '24px', border: 'none',
              background: moduleColor, color: 'white', fontSize: '1.1rem', fontWeight: '700',
              cursor: 'pointer', boxShadow: `0 8px 24px ${moduleColor}40`, transition: 'all 0.2s'
            }}
          >
            🎵 开始练习
          </button>
        </div>
      )}

      {/* Stages mode UI */}
      {((!isNotesModule && !isTheoryModule) || mode === 'stages') && (
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
