import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../core/store/useAppStore';

// ── 字典数据 ──────────────────────────────────────────────────
const SYMBOL_MAP: Record<string, string> = {
  'pp': '极弱 (pianissimo)', 'p': '弱 (piano)', 'mp': '中弱 (mezzo-piano)',
  'mf': '中强 (mezzo-forte)', 'f': '强 (forte)', 'ff': '极强 (fortissimo)',
  'fff': '最强 (fortississimo)', 'staccato': '断音 (staccato)',
  'accent': '重音 (accent >)', 'tenuto': '保持音 (tenuto —)',
  'fermata': '延音记号 (fermata 𝄐)', 'sfz': '突强 (sforzando)',
  'fp': '强后立弱 (forte-piano)', 'marcato': '顿音 (marcato ^)', 'trill': '颤音 (trill tr)',
};

const ALL_PITCHES: string[] = (() => {
  const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const accs = ['', '#', 'b'];
  const result: string[] = [];
  for (let oct = 2; oct <= 6; oct++)
    for (const n of notes)
      for (const a of accs)
        result.push(`${n}${a}${oct}`);
  return result;
})();

const ALL_INTERVALS = [
  '小二度 (m2)', '大二度 (M2)', '小三度 (m3)', '大三度 (M3)',
  '纯四度 (P4)', '三全音 (TT)', '纯五度 (P5)',
  '小六度 (m6)', '大六度 (M6)', '小七度 (m7)', '大七度 (M7)', '纯八度 (P8)',
];

const ALL_PATTERNS = ['上行音阶跑动', '下行音阶跑动', '分解和弦', '琶音上行', '琶音下行', 'Alberti Bass', '重复音型', '八度跳进'];

// 音程名 → 半音数
const INTERVAL_SEMITONES: Record<string, number> = {
  '小二度 (m2)': 1, '大二度 (M2)': 2, '小三度 (m3)': 3, '大三度 (M3)': 4,
  '纯四度 (P4)': 5, '三全音 (TT)': 6, '纯五度 (P5)': 7,
  '小六度 (m6)': 8, '大六度 (M6)': 9, '小七度 (m7)': 10, '大七度 (M7)': 11, '纯八度 (P8)': 12,
};

const STEP_TO_SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SEMI_TO_NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function calcSecondNote(pitch: string, intervalName: string): string | null {
  const m = pitch.match(/^([A-G])(#|b)?(\d)$/);
  if (!m) return null;
  const semitones = INTERVAL_SEMITONES[intervalName];
  if (semitones == null) return null;
  const alter = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const midi = STEP_TO_SEMI[m[1]] + alter + (parseInt(m[3]) + 1) * 12;
  const target = midi + semitones;
  const oct = Math.floor(target / 12) - 1;
  const note = SEMI_TO_NOTE[target % 12];
  return `${note}${oct}`;
}

// ── 自动补全输入框 ────────────────────────────────────────────
function AutocompleteInput({
  value, onChange, onSelect, candidates, placeholder, style, onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect?: (v: string) => void;
  candidates: string[];
  placeholder?: string;
  style?: React.CSSProperties;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = value.trim()
    ? candidates.filter(c => c.toLowerCase().includes(value.toLowerCase())).slice(0, 10)
    : [];

  useEffect(() => {
    setActiveIdx(-1);
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (v: string) => {
    onChange(v);
    onSelect?.(v);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (open && filtered.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); return; }
      if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); select(filtered[activeIdx]); return; }
      if (e.key === 'Escape') { setOpen(false); return; }
    }
    onKeyDown?.(e);
  };

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1 }}>
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '1rem', boxSizing: 'border-box', ...style }}
      />
      {open && filtered.length > 0 && (
        <ul style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'white', border: '1px solid #d1d5db', borderRadius: '8px',
          margin: '4px 0 0', padding: 0, listStyle: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '220px', overflowY: 'auto',
        }}>
          {filtered.map((item, i) => (
            <li
              key={item}
              onMouseDown={() => select(item)}
              style={{
                padding: '10px 16px', cursor: 'pointer', fontSize: '0.95rem',
                background: i === activeIdx ? '#eff6ff' : 'white',
                color: i === activeIdx ? '#1d4ed8' : '#1f2937',
              }}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IntervalRow({ noteA, setNoteA, intervalName, setIntervalName, onAdd }: {
  noteA: string; setNoteA: (v: string) => void;
  intervalName: string; setIntervalName: (v: string) => void;
  onAdd: () => void;
}) {
  const derived = calcSecondNote(noteA.trim(), intervalName.trim());
  const ready = !!noteA.trim() && !!intervalName.trim() && !!derived;
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
      <AutocompleteInput value={noteA} onChange={setNoteA} candidates={ALL_PITCHES} placeholder="起始音，如 C4" />
      <span style={{ color: '#9ca3af', whiteSpace: 'nowrap' }}>+</span>
      <AutocompleteInput
        value={intervalName} onChange={setIntervalName} candidates={ALL_INTERVALS}
        placeholder="音程，如 纯五度 (P5)"
        onKeyDown={(e) => e.key === 'Enter' && onAdd()}
      />
      <span style={{ color: '#9ca3af', whiteSpace: 'nowrap' }}>=</span>
      <div style={{
        flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid #d1d5db',
        background: '#f9fafb', fontSize: '1rem', minWidth: '80px',
        color: derived ? '#059669' : '#9ca3af', fontWeight: derived ? 'bold' : 'normal',
      }}>{derived ?? '—'}</div>
      <button onClick={onAdd} disabled={!ready} style={{
        padding: '12px 24px', borderRadius: '8px', border: 'none', whiteSpace: 'nowrap',
        background: ready ? '#3b82f6' : '#94a3b8', color: 'white', fontWeight: 'bold',
        cursor: ready ? 'pointer' : 'not-allowed',
      }}>+ 添加到素材池</button>
    </div>
  );
}

const TYPE_OPTIONS = [
  { value: 'A', label: '单音 (A)', placeholder: '输入音高，如 C4、F#5、Bb3' },
  { value: 'B', label: '音乐表情记号 (B)', placeholder: '输入符号名称，如 ff、staccato、fermata' },
  { value: 'C', label: '双音/音程关系 (C)', placeholder: '格式: 音符1,音符2|名称，如 C4,G4|纯五度 (P5)' },
  { value: 'D', label: '音型 (D)', placeholder: '输入音型描述，如 上行音阶 C-D-E-F-G' },
];

export default function ManualCreator() {
  const addSlices = useAppStore(state => state.addSlices);

  const [type, setType] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [content, setContent] = useState('');
  const [symbolAnswer, setSymbolAnswer] = useState('');
  // C 类分步字段
  const [noteA, setNoteA] = useState('');
  const [intervalName, setIntervalName] = useState('');
  const [difficulty, setDifficulty] = useState(1);
  const [batchMode, setBatchMode] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const currentTypeOption = TYPE_OPTIONS.find(t => t.value === type)!;

  const handleAddSingle = () => {
    let sliceContent: object;
    let idKey: string;

    if (type === 'C') {
      const noteB = calcSecondNote(noteA.trim(), intervalName.trim());
      if (!noteA.trim() || !intervalName.trim() || !noteB) return;
      const raw = `${noteA},${noteB}|${intervalName}`;
      sliceContent = { theory: intervalName.trim(), notes: [noteA.trim(), noteB], raw };
      idKey = raw;
    } else {
      if (!content.trim()) return;
      if (type === 'B' && !symbolAnswer.trim()) return;
      sliceContent = buildContent(type, content.trim());
      idKey = content.trim();
    }

    addSlices([{ id: `manual_${type}_${Date.now()}_${idKey}`, type, content: sliceContent, difficulty }]);
    setContent(''); setSymbolAnswer(''); setNoteA(''); setIntervalName('');
    showSuccess('已添加 1 道题目');
  };

  const handleAddBatch = () => {
    if (!batchText.trim()) return;

    // 按换行分割，每行为一道题
    // B 类格式: "符号|答案"，如 "pp|极弱 (pianissimo)"
    const lines = batchText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const slices = lines.map((line, idx) => {
      let contentObj;
      if (type === 'B' && line.includes('|')) {
        const [symbol, answer] = line.split('|').map(s => s.trim());
        contentObj = { symbol, answer };
      } else {
        contentObj = buildContent(type, line);
      }
      return {
        id: `manual_${type}_${Date.now()}_${idx}_${line}`,
        type: type,
        content: contentObj,
        difficulty
      };
    });

    addSlices(slices);
    setBatchText('');
    showSuccess(`已批量添加 ${slices.length} 道题目`);
  };

  const buildContent = (type: string, value: string) => {
    switch (type) {
      case 'A': return { pitch: value, raw: value };
      case 'B': return { symbol: value, answer: symbolAnswer.trim() };
      case 'C': {
        if (value.includes('|')) {
          const [notesPart, theory] = value.split('|').map(s => s.trim());
          const notes = notesPart.split(',').map(s => s.trim()).filter(Boolean);
          return { theory, notes, raw: value };
        }
        return { theory: value, raw: value };
      }
      case 'D': return { pattern: value, raw: value };
      default: return { raw: value };
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 2000);
  };

  return (
    <div style={{ maxWidth: '800px' }}>
      <h1 style={{ fontSize: '2rem', color: '#1f2937', marginBottom: '10px' }}>手动出题器</h1>
      <p style={{ color: '#6b7280', marginBottom: '30px' }}>
        对于引擎无法自动识别的音型或乐理概念，教师可以在此手动创建题目并推送至素材池。
      </p>

      {/* 成功提示 */}
      {successMsg && (
        <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', padding: '12px 20px', borderRadius: '8px', color: '#065f46', fontWeight: 'bold', marginBottom: '20px' }}>
          ✓ {successMsg}
        </div>
      )}

      {/* 题目类型选择 */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#374151' }}>题目类型</label>
        <div style={{ display: 'flex', gap: '10px' }}>
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setType(opt.value as any)}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: type === opt.value ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                background: type === opt.value ? '#eff6ff' : 'white',
                color: type === opt.value ? '#1d4ed8' : '#6b7280',
                fontWeight: type === opt.value ? 'bold' : 'normal',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 难度选择 */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#374151' }}>
          难度等级: <span style={{ color: '#f59e0b' }}>L{difficulty}</span>
        </label>
        <input
          type="range"
          min="1"
          max="10"
          value={difficulty}
          onChange={(e) => setDifficulty(parseInt(e.target.value))}
          style={{ width: '100%', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af', fontSize: '0.8rem', marginTop: '4px' }}>
          <span>L1 入门</span><span>L5 中等</span><span>L10 大师</span>
        </div>
      </div>

      {/* 模式切换 */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
        <button
          onClick={() => setBatchMode(false)}
          style={{
            padding: '8px 20px', borderRadius: '20px', border: 'none',
            background: !batchMode ? '#1f2937' : '#f3f4f6',
            color: !batchMode ? 'white' : '#6b7280',
            fontWeight: 'bold', cursor: 'pointer'
          }}
        >
          单条添加
        </button>
        <button
          onClick={() => setBatchMode(true)}
          style={{
            padding: '8px 20px', borderRadius: '20px', border: 'none',
            background: batchMode ? '#1f2937' : '#f3f4f6',
            color: batchMode ? 'white' : '#6b7280',
            fontWeight: 'bold', cursor: 'pointer'
          }}
        >
          批量添加
        </button>
      </div>

      {/* 输入区域 */}
      {!batchMode ? (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
            {type === 'C' ? (
              <IntervalRow
                noteA={noteA} setNoteA={setNoteA}
                intervalName={intervalName} setIntervalName={setIntervalName}
                onAdd={handleAddSingle}
              />
            ) : (
              // A / B / D 类型
              <>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <AutocompleteInput
                    value={content} onChange={setContent}
                    candidates={type === 'A' ? ALL_PITCHES : type === 'B' ? Object.keys(SYMBOL_MAP) : ALL_PATTERNS}
                    placeholder={currentTypeOption.placeholder}
                    onKeyDown={(e) => e.key === 'Enter' && type !== 'B' && handleAddSingle()}
                  />
                  {type !== 'B' && (
                    <button onClick={handleAddSingle} disabled={!content.trim()} style={{
                      padding: '12px 24px', borderRadius: '8px', border: 'none', whiteSpace: 'nowrap',
                      background: content.trim() ? '#3b82f6' : '#94a3b8', color: 'white', fontWeight: 'bold',
                      cursor: content.trim() ? 'pointer' : 'not-allowed',
                    }}>+ 添加到素材池</button>
                  )}
                </div>
                {type === 'B' && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <AutocompleteInput
                      value={symbolAnswer} onChange={v => setSymbolAnswer(v)}
                      candidates={Object.values(SYMBOL_MAP)}
                      placeholder="输入正确答案，如 极弱 (pianissimo)"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddSingle()}
                    />
                    <button onClick={handleAddSingle} disabled={!content.trim() || !symbolAnswer.trim()} style={{
                      padding: '12px 24px', borderRadius: '8px', border: 'none', whiteSpace: 'nowrap',
                      background: content.trim() && symbolAnswer.trim() ? '#3b82f6' : '#94a3b8',
                      color: 'white', fontWeight: 'bold',
                      cursor: content.trim() && symbolAnswer.trim() ? 'pointer' : 'not-allowed',
                    }}>+ 添加到素材池</button>
                  </div>
                )}
              </>
            )}
          </div>
          <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
            {type === 'B' ? '第一行输入符号（题面），第二行输入答案含义' : type === 'C' ? '输入起始音和音程，第二个音自动推算' : '按回车可快速提交'}
          </p>
        </div>
      ) : (
        <div>
          <textarea
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            placeholder={type === 'B'
              ? `每行格式: 符号|答案，例如：\npp|极弱 (pianissimo)\nff|极强 (fortissimo)\nstaccato|断音\nfermata|延音记号`
              : `每行输入一道题目，例如：\nC4\nD4\nE4\nF#5\nG3`}
            style={{
              width: '100%', height: '200px', padding: '16px', borderRadius: '8px',
              border: '1px solid #d1d5db', fontSize: '1rem', resize: 'vertical',
              fontFamily: 'monospace', lineHeight: '1.8'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
            <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
              已输入 {batchText.split('\n').filter(l => l.trim()).length} 行
            </span>
            <button
              onClick={handleAddBatch}
              disabled={!batchText.trim()}
              style={{
                padding: '12px 24px', borderRadius: '8px', border: 'none',
                background: batchText.trim() ? '#3b82f6' : '#94a3b8',
                color: 'white', fontWeight: 'bold', cursor: batchText.trim() ? 'pointer' : 'not-allowed'
              }}
            >
              批量添加到素材池
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
