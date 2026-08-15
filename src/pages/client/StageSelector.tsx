import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../core/store/useAppStore';
import NotesInputModeToggle from '../../components/NotesInputModeToggle';
import { useNotesInputMode } from '../../hooks/useNotesInputMode';
import {
  INTERVAL_CATALOG,
  QUALITY_LABELS,
  NUMBER_LABELS,
  type CatalogInterval,
  type IntervalNumber,
  type IntervalQuality,
} from '../../core/theory/intervalCatalog';
import {
  type Subset,
  DEFAULT_SUBSET,
  toggleInterval,
  isNonEmpty,
} from '../../core/theory/intervalSelection';
import { SCOPE_PARAM, encodeScope } from '../../core/theory/scopeSerializer';

// Catalog interval numbers (1..8) — table rows.
const INTERVAL_NUMBERS: IntervalNumber[] = [1, 2, 3, 4, 5, 6, 7, 8];
// Catalog qualities in table-column order: 减 小 纯 大 增.
const INTERVAL_QUALITIES: IntervalQuality[] = [
  'diminished',
  'minor',
  'perfect',
  'major',
  'augmented',
];
// Lookup for a catalog entry by (number, quality); absent pairs (e.g. perfect 6th) are empty cells.
const CATALOG_CELL = new Map<string, CatalogInterval>(
  INTERVAL_CATALOG.map((entry) => [`${entry.number},${entry.quality}`, entry]),
);

// Compact ＋ / − header buttons for bulk select / clear of a row or column.
const groupBtnStyle: React.CSSProperties = {
  width: '20px', height: '20px', lineHeight: '1', padding: 0, borderRadius: '7px',
  cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', color: '#6b7280',
  border: '1px solid #d1d5db', background: 'white',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};

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
  const [mode, setMode] = useNotesInputMode();
  const [lowPitch, setLowPitch] = useState('C2');
  const [highPitch, setHighPitch] = useState('C6');
  const [includeSharps, setIncludeSharps] = useState(false);
  const [includeFlats, setIncludeFlats] = useState(false);

  // Theory practice scope: a set of catalog interval IDs (Selected_Interval_Subset).
  const [subset, setSubset] = useState<Subset>(DEFAULT_SUBSET);

  const moduleLabel = MODULE_LABELS[moduleId || ''] || moduleId;
  const moduleColor = MODULE_COLORS[moduleId || ''] || '#3b82f6';

  const isNotesModule = moduleId === 'notes';
  const isTheoryModule = moduleId === 'theory';
  const canStartPractice = isValidPitch(lowPitch) && isValidPitch(highPitch);

  const getAllStages = useAppStore(state => state.getAllStages);
  // Subscribe to customStages + slicesPool so component re-renders when remote data loads
  useAppStore(state => state.customStages);
  useAppStore(state => state.slicesPool);
  const stages = getAllStages(moduleId || '');

  const handleStartPractice = () => {
    if (!canStartPractice) return;
    const low = lowPitch.charAt(0).toUpperCase() + lowPitch.charAt(1);
    const high = highPitch.charAt(0).toUpperCase() + highPitch.charAt(1);
    const sharp = includeSharps ? '&sharp=1' : '';
    const flat = includeFlats ? '&flat=1' : '';
    navigate(`/client/practice/notes?low=${low}&high=${high}${sharp}${flat}`);
  };

  const canStartTheoryPractice = isNonEmpty(subset);

  // Cell toggle: flip a single interval on/off.
  const toggleCell = (id: string, checked: boolean) => {
    setSubset((prev) => toggleInterval(prev, id, checked));
  };

  // Header toggle: select all of a row (number) or column (quality) when any is
  // missing, otherwise clear them all.
  // Header actions: explicitly select all (＋) or clear all (−) of a group.
  const setGroup = (entries: CatalogInterval[], selected: boolean) => {
    if (entries.length === 0) return;
    setSubset((prev) => {
      const next = new Set(prev);
      for (const e of entries) {
        if (selected) next.add(e.id);
        else next.delete(e.id);
      }
      return next;
    });
  };

  const entriesOfNumber = (n: IntervalNumber) =>
    INTERVAL_CATALOG.filter((e) => e.number === n);
  const entriesOfQuality = (q: IntervalQuality) =>
    INTERVAL_CATALOG.filter((e) => e.quality === q);

  const handleStartTheoryPractice = () => {
    if (!canStartTheoryPractice) return;
    navigate(`/client/practice/intervals?${SCOPE_PARAM}=${encodeScope(subset)}`);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <button
        onClick={() => { if (window.history.length > 1) { navigate(-1); } else { navigate('/client', { replace: true }); } }}
        style={{ alignSelf: 'flex-start', background: 'white', border: '1px solid #e5e7eb', padding: '8px 16px', borderRadius: '20px', fontSize: '1rem', cursor: 'pointer', color: '#6b7280', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
      >
        ← 返回
      </button>
      <h1 className="stage-selector-title" style={{ fontSize: '2.5rem', fontWeight: '800', color: '#111827', marginTop: '30px', letterSpacing: '-1px' }}>
        {moduleLabel} Trials
      </h1>

      {/* Input mode toggle (keyboard vs options) — only for Notes */}
      {isNotesModule && (
        <div style={{ marginTop: '12px' }}>
          <NotesInputModeToggle mode={mode} onChange={setMode} accentColor={moduleColor} />
        </div>
      )}

      {/* Notes practice mode UI */}
      {isNotesModule && (
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

      {/* Theory practice mode UI — interval scope selection */}
      {isTheoryModule && (
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%', maxWidth: '760px' }}>
          <p style={{ color: '#6b7280', fontSize: '0.95rem', textAlign: 'center', maxWidth: '460px', margin: 0 }}>
            选择要练习的音程范围，系统将在所选范围内随机生成音程练习题
          </p>

          {/* Interval matrix: rows = degrees 1–8, columns = 减 小 纯 大 增. Header buttons bulk-toggle a row/column. */}
          <div style={{ width: '100%', overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: '4px', margin: '0 auto' }}>
              <thead>
                <tr>
                  <th aria-hidden="true" />
                  {INTERVAL_QUALITIES.map(q => (
                    <th key={q}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: 'clamp(0.72rem, 3vw, 0.9rem)', fontWeight: '700', color: '#4b5563' }}>{QUALITY_LABELS[q]}</span>
                        <div style={{ display: 'flex', gap: '2px' }}>
                          <button type="button" onClick={() => setGroup(entriesOfQuality(q), true)} title="全选该性质" style={groupBtnStyle}>＋</button>
                          <button type="button" onClick={() => setGroup(entriesOfQuality(q), false)} title="全不选该性质" style={groupBtnStyle}>－</button>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {INTERVAL_NUMBERS.map(n => (
                  <tr key={n}>
                    <th>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <span style={{ fontSize: 'clamp(0.78rem, 3vw, 0.95rem)', fontWeight: '700', color: '#4b5563', whiteSpace: 'nowrap' }}>{NUMBER_LABELS[n]}</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <button type="button" onClick={() => setGroup(entriesOfNumber(n), true)} title="全选该度数" style={groupBtnStyle}>＋</button>
                          <button type="button" onClick={() => setGroup(entriesOfNumber(n), false)} title="全不选该度数" style={groupBtnStyle}>－</button>
                        </div>
                      </div>
                    </th>
                    {INTERVAL_QUALITIES.map(q => {
                      const entry = CATALOG_CELL.get(`${n},${q}`);
                      if (!entry) return <td key={q} />;
                      const active = subset.has(entry.id);
                      return (
                        <td key={q}>
                          <button
                            type="button"
                            onClick={() => toggleCell(entry.id, !active)}
                            style={{
                              width: '100%', minWidth: 'clamp(26px, 7.5vw, 40px)', padding: '7px 2px',
                              borderRadius: '8px', cursor: 'pointer',
                              fontSize: 'clamp(0.68rem, 3vw, 0.88rem)', fontWeight: '700',
                              fontFamily: 'monospace', transition: 'all 0.15s',
                              border: active ? `2px solid ${moduleColor}` : '2px solid #e5e7eb',
                              background: active ? `${moduleColor}12` : 'white',
                              color: active ? moduleColor : '#374151',
                            }}
                          >
                            {entry.abbr}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!canStartTheoryPractice && (
            <p style={{ color: '#f87171', fontSize: '0.85rem', margin: 0 }}>请至少选择一个音程</p>
          )}

          <button
            onClick={handleStartTheoryPractice}
            disabled={!canStartTheoryPractice}
            style={{
              marginTop: '4px', padding: '14px 40px', borderRadius: '24px', border: 'none',
              background: canStartTheoryPractice ? moduleColor : '#94a3b8',
              color: 'white', fontSize: '1.1rem', fontWeight: '700',
              cursor: canStartTheoryPractice ? 'pointer' : 'not-allowed',
              boxShadow: canStartTheoryPractice ? `0 8px 24px ${moduleColor}40` : 'none',
              transition: 'all 0.2s'
            }}
          >
            🎵 开始练习
          </button>
        </div>
      )}
      {/* Stages grid for modules without practice config (symbols, patterns) */}
      {!isNotesModule && !isTheoryModule && (
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
