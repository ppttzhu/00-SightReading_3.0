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
import { CHORD_CATALOG, displayLabel } from '../../core/chords/chordCatalog';
import {
  type SelectedChordTypes,
  DEFAULT_SELECTION,
  toggleType,
  isNonEmpty as isChordSelectionNonEmpty,
} from '../../core/chords/chordSelection';
import {
  SCOPE_PARAM as CHORD_SCOPE_PARAM,
  encodeScope as encodeChordScope,
} from '../../core/chords/chordScopeSerializer';
import { LEVEL6_PROGRESSIONS, type ProgressionId } from '../../core/progression/progressions';
import {
  type SelectedProgressions,
  DEFAULT_SELECTION as DEFAULT_PROGRESSION_SELECTION,
  toggleProgression,
  isNonEmpty as isProgressionSelectionNonEmpty,
} from '../../core/progression/progressionSelection';
import {
  SCOPE_PARAM as PROGRESSION_SCOPE_PARAM,
  encodeScope as encodeProgressionScope,
} from '../../core/progression/progressionScopeSerializer';
import { PLAYBACK_KEYS, type PlaybackKey } from '../../core/playback/playbackTypes';
import {
  type SelectedKeys as SelectedPlaybackKeys,
  type PlaybackMode,
  DEFAULT_KEYS as DEFAULT_PLAYBACK_KEYS,
  DEFAULT_MODE as DEFAULT_PLAYBACK_MODE,
  toggleKey as togglePlaybackKey,
  isNonEmpty as isPlaybackSelectionNonEmpty,
} from '../../core/playback/playbackSelection';
import {
  KEYS_PARAM as PLAYBACK_KEYS_PARAM,
  MODE_PARAM as PLAYBACK_MODE_PARAM,
  encodeKeys as encodePlaybackKeys,
} from '../../core/playback/playbackScopeSerializer';

/** Display labels for the four progressions in the scope selector — Roman numerals only (case conveys major/minor). */
const PROGRESSION_LABELS: Record<ProgressionId, string> = {
  maj_sub: 'I – IV – I',
  maj_dom: 'I – V – I',
  min_sub: 'i – iv – i',
  min_dom: 'i – V – i',
};

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
  chords: '和弦识别',
  patterns: '音型',
  playback: '旋律回放',
};

const MODULE_COLORS: Record<string, string> = {
  notes: '#3b82f6',
  symbols: '#ec4899',
  theory: '#8b5cf6',
  chords: '#d97706',
  patterns: '#10b981',
  playback: '#0ea5e9',
};

/** Display labels for the four RCM6 Playback keys in the setup selector. */
const PLAYBACK_KEY_LABELS: Record<PlaybackKey, string> = {
  'G major': 'G Major',
  'E major': 'E Major',
  'G minor': 'G minor',
  'E minor': 'E minor',
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
  // Whether to show the score during interval practice. Default off → two
  // speakers, score revealed 1s after a correct answer.
  const [showIntervalScore, setShowIntervalScore] = useState(false);

  // Patterns (和弦) random-practice scope: a set of chord catalog IDs.
  const [chordSelection, setChordSelection] = useState<SelectedChordTypes>(DEFAULT_SELECTION);
  // Whether to show the score during chord practice. Default off: the practice
  // screen shows two speakers (blocked / arpeggiated) and only reveals the score
  // for 1s after a correct answer.
  const [showChordScore, setShowChordScore] = useState(false);

  // Patterns (和声进行) RCM6 progression scope: a set of ProgressionIds.
  const [progressionSelection, setProgressionSelection] = useState<SelectedProgressions>(DEFAULT_PROGRESSION_SELECTION);
  // Whether to show the score during progression practice. Default off → one
  // speaker, score revealed 1s after a correct answer.
  const [showProgressionScore, setShowProgressionScore] = useState(false);

  // Playback (RCM6 旋律回放): selected keys + mode (bank vs random).
  const [playbackKeys, setPlaybackKeys] = useState<SelectedPlaybackKeys>(DEFAULT_PLAYBACK_KEYS);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(DEFAULT_PLAYBACK_MODE);

  const moduleLabel = MODULE_LABELS[moduleId || ''] || moduleId;
  const moduleColor = MODULE_COLORS[moduleId || ''] || '#3b82f6';

  const isNotesModule = moduleId === 'notes';
  const isTheoryModule = moduleId === 'theory';
  const isChordsModule = moduleId === 'chords';
  const isPatternsModule = moduleId === 'patterns';
  const isPlaybackModule = moduleId === 'playback';
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
    const scoreParam = showIntervalScore ? '&score=1' : '';
    navigate(`/client/practice/intervals?${SCOPE_PARAM}=${encodeScope(subset)}${scoreParam}`);
  };

  // Chord random-practice scope (Selected_Chord_Types) — toggle, guard, start.
  const canStartChordPractice = isChordSelectionNonEmpty(chordSelection);

  const toggleChord = (id: string, checked: boolean) => {
    setChordSelection((prev) => toggleType(prev, id, checked));
  };

  const handleStartChordPractice = () => {
    if (!canStartChordPractice) return;
    const scoreParam = showChordScore ? '&score=1' : '';
    navigate(`/client/practice/chords?${CHORD_SCOPE_PARAM}=${encodeChordScope(chordSelection)}${scoreParam}`);
  };

  // Progression (和声进行) scope selection — toggle, guard, start.
  const canStartProgressionPractice = isProgressionSelectionNonEmpty(progressionSelection);

  const toggleProgressionOption = (id: ProgressionId, checked: boolean) => {
    setProgressionSelection((prev) => toggleProgression(prev, id, checked));
  };

  const handleStartProgressionPractice = () => {
    if (!canStartProgressionPractice) return;
    const scoreParam = showProgressionScore ? '&score=1' : '';
    navigate(`/client/practice/progression?${PROGRESSION_SCOPE_PARAM}=${encodeProgressionScope(progressionSelection)}${scoreParam}`);
  };

  // Playback (RCM6 旋律回放) — key multi-select, mode, start.
  const canStartPlayback = isPlaybackSelectionNonEmpty(playbackKeys);

  const togglePlaybackKeyOption = (key: PlaybackKey, checked: boolean) => {
    setPlaybackKeys((prev) => togglePlaybackKey(prev, key, checked));
  };

  const handleStartPlayback = () => {
    if (!canStartPlayback) return;
    navigate(`/client/practice/playback?${PLAYBACK_KEYS_PARAM}=${encodePlaybackKeys(playbackKeys)}&${PLAYBACK_MODE_PARAM}=${playbackMode}`);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <button
        onClick={() => { if (window.history.length > 1) { navigate(-1); } else { navigate('/client', { replace: true }); } }}
        style={{ alignSelf: 'flex-start', background: 'white', border: '1px solid #e5e7eb', padding: '8px 16px', borderRadius: '20px', fontSize: '1rem', cursor: 'pointer', color: '#6b7280', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
      >
        ← 返回
      </button>
      <h1 className="stage-selector-title" style={{ fontSize: '2.5rem', fontWeight: '800', color: '#111827', marginTop: '12px', marginBottom: '8px', letterSpacing: '-1px' }}>
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
            选择要练习的音程范围，系统将随机出题
          </p>

          {/* Interval matrix: rows = degrees 1–8, columns = 减 小 纯 大 增. Header buttons bulk-toggle a row/column. */}
          <div style={{ width: '100%', overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: '1px', margin: '0 auto' }}>
              <thead>
                <tr>
                  <th aria-hidden="true" />
                  {INTERVAL_QUALITIES.map(q => (
                    <th key={q}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: 'clamp(0.72rem, 3vw, 0.9rem)', fontWeight: '700', color: '#4b5563' }}>{QUALITY_LABELS[q]}</span>
                        <div style={{ display: 'flex', gap: '1px' }}>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
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

          {/* Show-score toggle (default off → speakers-only practice) */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#374151', fontSize: '0.95rem', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={showIntervalScore}
              onChange={(e) => setShowIntervalScore(e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            显示乐谱
          </label>

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
      {/* Chord (和弦识别) random-practice scope selector */}
      {isChordsModule && (
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%', maxWidth: '620px' }}>
          <p style={{ color: '#6b7280', fontSize: '0.95rem', textAlign: 'center', maxWidth: '460px', margin: 0 }}>
            选择要练习的和弦类型，系统将随机出题
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
            {CHORD_CATALOG.map((entry) => {
              const active = chordSelection.has(entry.id);
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => toggleChord(entry.id, !active)}
                  aria-pressed={active}
                  style={{
                    padding: '10px 18px', borderRadius: '20px', cursor: 'pointer',
                    fontSize: '0.95rem', fontWeight: '700', fontFamily: 'monospace',
                    transition: 'all 0.15s',
                    border: active ? `2px solid ${moduleColor}` : '2px solid #e5e7eb',
                    background: active ? `${moduleColor}12` : 'white',
                    color: active ? moduleColor : '#374151',
                  }}
                >
                  {displayLabel(entry)}
                </button>
              );
            })}
          </div>

          {/* Show-score toggle (default off → speakers-only practice) */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#374151', fontSize: '0.95rem', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={showChordScore}
              onChange={(e) => setShowChordScore(e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            显示乐谱
          </label>

          {!canStartChordPractice && (
            <p style={{ color: '#f87171', fontSize: '0.85rem', margin: 0 }}>请至少选择一个和弦</p>
          )}

          <button
            onClick={handleStartChordPractice}
            disabled={!canStartChordPractice}
            style={{
              marginTop: '4px', padding: '14px 40px', borderRadius: '24px', border: 'none',
              background: canStartChordPractice ? moduleColor : '#94a3b8',
              color: 'white', fontSize: '1.1rem', fontWeight: '700',
              cursor: canStartChordPractice ? 'pointer' : 'not-allowed',
              boxShadow: canStartChordPractice ? `0 8px 24px ${moduleColor}40` : 'none',
              transition: 'all 0.2s'
            }}
          >
            🎵 开始练习
          </button>
        </div>
      )}

      {/* Playback (RCM6 旋律回放) setup: choose keys + mode, then start. */}
      {isPlaybackModule && (
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', width: '100%', maxWidth: '560px' }}>
          <p style={{ color: '#6b7280', fontSize: '0.95rem', textAlign: 'center', maxWidth: '460px', margin: 0 }}>
            选择要练习的调，老师先弹主和弦再弹旋律，你来回放
          </p>

          {/* Key multi-select */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
            {PLAYBACK_KEYS.map((key) => {
              const active = playbackKeys.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => togglePlaybackKeyOption(key, !active)}
                  aria-pressed={active}
                  style={{
                    padding: '10px 18px', borderRadius: '20px', cursor: 'pointer',
                    fontSize: '0.95rem', fontWeight: '700', transition: 'all 0.15s',
                    border: active ? `2px solid ${moduleColor}` : '2px solid #e5e7eb',
                    background: active ? `${moduleColor}12` : 'white',
                    color: active ? moduleColor : '#374151',
                  }}
                >
                  {PLAYBACK_KEY_LABELS[key]}
                </button>
              );
            })}
          </div>

          {/* Mode toggle: 题库 / 随机出题 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '20px', padding: '6px 8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            {([{ key: 'bank', label: '题库' }, { key: 'random', label: '随机出题' }] as const).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setPlaybackMode(m.key)}
                style={{
                  padding: '8px 22px', borderRadius: '14px', border: 'none', cursor: 'pointer',
                  fontWeight: '700', fontSize: '0.95rem',
                  background: playbackMode === m.key ? moduleColor : 'transparent',
                  color: playbackMode === m.key ? 'white' : '#6b7280',
                  transition: 'all 0.2s',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {!canStartPlayback && (
            <p style={{ color: '#f87171', fontSize: '0.85rem', margin: 0 }}>请至少选择一个调</p>
          )}

          <button
            onClick={handleStartPlayback}
            disabled={!canStartPlayback}
            style={{
              marginTop: '4px', padding: '14px 40px', borderRadius: '24px', border: 'none',
              background: canStartPlayback ? moduleColor : '#94a3b8',
              color: 'white', fontSize: '1.1rem', fontWeight: '700',
              cursor: canStartPlayback ? 'pointer' : 'not-allowed',
              boxShadow: canStartPlayback ? `0 8px 24px ${moduleColor}40` : 'none',
              transition: 'all 0.2s',
            }}
          >
            🎵 开始练习
          </button>
        </div>
      )}

      {/* Patterns (音型): the RCM Level 6 chord-progression exercise with its own
          scope selector. The database-authored 音型 stages grid is intentionally
          hidden here — this page serves the progression exercise only. */}
      {isPatternsModule && (
        <>
          {moduleId === 'patterns' && (
            <div style={{ marginTop: '24px', marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%', maxWidth: '620px' }}>
              <p style={{ color: '#6b7280', fontSize: '0.95rem', textAlign: 'center', maxWidth: '460px', margin: 0 }}>
                选择要练习的和声进行，系统将随机出题
              </p>

              {/* Two rows: 大调 (major) progressions on top, 小调 (minor) below. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                {([
                  { mode: 'major' as const, label: '大调' },
                  { mode: 'minor' as const, label: '小调' },
                ]).map(({ mode: rowMode, label }) => (
                  <div key={rowMode} style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#4b5563', minWidth: '32px', textAlign: 'right' }}>{label}</span>
                    {LEVEL6_PROGRESSIONS.filter((p) => p.mode === rowMode).map((p) => {
                      const active = progressionSelection.has(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleProgressionOption(p.id, !active)}
                          aria-pressed={active}
                          style={{
                            padding: '10px 18px', borderRadius: '20px', cursor: 'pointer',
                            fontSize: '0.95rem', fontWeight: '700', fontFamily: 'monospace',
                            transition: 'all 0.15s',
                            border: active ? `2px solid ${moduleColor}` : '2px solid #e5e7eb',
                            background: active ? `${moduleColor}12` : 'white',
                            color: active ? moduleColor : '#374151',
                          }}
                        >
                          {PROGRESSION_LABELS[p.id]}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Show-score toggle (default off → speaker-only practice) */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#374151', fontSize: '0.95rem', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={showProgressionScore}
                  onChange={(e) => setShowProgressionScore(e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                显示乐谱
              </label>

              {!canStartProgressionPractice && (
                <p style={{ color: '#f87171', fontSize: '0.85rem', margin: 0 }}>请至少选择一个和声进行</p>
              )}

              <button
                onClick={handleStartProgressionPractice}
                disabled={!canStartProgressionPractice}
                style={{
                  marginTop: '4px', padding: '14px 40px', borderRadius: '24px', border: 'none',
                  background: canStartProgressionPractice ? moduleColor : '#94a3b8',
                  color: 'white', fontSize: '1.1rem', fontWeight: '700',
                  cursor: canStartProgressionPractice ? 'pointer' : 'not-allowed',
                  boxShadow: canStartProgressionPractice ? `0 8px 24px ${moduleColor}40` : 'none',
                  transition: 'all 0.2s',
                }}
              >
                🎵 开始练习
              </button>
            </div>
          )}
        </>
      )}

      {/* Stages grid for modules without practice config (e.g. symbols). Patterns
          and playback are excluded — they show their own selectors above. */}
      {!isNotesModule && !isTheoryModule && !isChordsModule && !isPatternsModule && !isPlaybackModule && (
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
