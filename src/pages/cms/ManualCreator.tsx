import { useState, useRef, useEffect } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, StaveConnector, Stem } from 'vexflow';
import { useAppStore } from '../../core/store/useAppStore';
import { resolvePlacement } from '../../core/engine/pitchUtils';
import type { StaffPlacement } from '../../core/engine/pitchUtils';

const NOTE_STEP: Record<string, number> = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6 };

function getDiatonicStep(key: string): number {
  const [, note, octave] = key.match(/^([a-g])\/(\d)$/) || [];
  if (!note || !octave) return 0;
  return NOTE_STEP[note] + parseInt(octave) * 7;
}

function resolveStemDirection(keyA: string, keyB: string, clef: string): number {
  const middleNote = clef === 'bass' ? 'd' : 'b';
  const middleOctave = clef === 'bass' ? 3 : 4;
  const middleStep = NOTE_STEP[middleNote] + middleOctave * 7;

  const stepA = getDiatonicStep(keyA);
  const stepB = getDiatonicStep(keyB);

  if (stepA > middleStep) return Stem.DOWN;
  if (stepA < middleStep) return Stem.UP;
  if (stepB > middleStep) return Stem.DOWN;
  if (stepB < middleStep) return Stem.UP;
  return Stem.DOWN;
}
import type { IntervalContent } from '../../core/store/useAppStore';

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
  '纯一度 (P1)', '小二度 (m2)', '大二度 (M2)', '小三度 (m3)', '大三度 (M3)',
  '纯四度 (P4)', '增四度 (A4)', '三全音 (TT)', '减五度 (d5)', '纯五度 (P5)',
  '小六度 (m6)', '大六度 (M6)', '小七度 (m7)', '大七度 (M7)', '纯八度 (P8)',
];

const ALL_PATTERNS = ['上行音阶跑动', '下行音阶跑动', '分解和弦', '琶音上行', '琶音下行', 'Alberti Bass', '重复音型', '八度跳进'];

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

// 计算两个音之间的音程名称
function calcIntervalName(noteA: string, noteB: string): string | null {
  const STEP_TO_SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const INTERVAL_MAP: Record<number, string> = {
    0: '纯一度 (P1)', 1: '小二度 (m2)', 2: '大二度 (M2)', 3: '小三度 (m3)', 4: '大三度 (M3)',
    5: '纯四度 (P4)', 6: '增四度/减五度 (A4/d5)', 7: '纯五度 (P5)',
    8: '小六度 (m6)', 9: '大六度 (M6)', 10: '小七度 (m7)', 11: '大七度 (M7)', 12: '纯八度 (P8)',
  };

  const parsePitch = (p: string) => {
    const m = p.match(/^([A-G])(#|b)?(\d)$/);
    if (!m) return null;
    const alter = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
    return STEP_TO_SEMI[m[1]] + alter + (parseInt(m[3]) + 1) * 12;
  };

  const midiA = parsePitch(noteA);
  const midiB = parsePitch(noteB);
  if (midiA == null || midiB == null) return null;

  const semitones = Math.abs(midiB - midiA) % 12;
  return INTERVAL_MAP[semitones] || null;
}

function IntervalRow({ noteA, setNoteA, noteB, setNoteB, intervalName, setIntervalName, onAdd }: {
  noteA: string; setNoteA: (v: string) => void;
  noteB: string; setNoteB: (v: string) => void;
  intervalName: string; setIntervalName: (v: string) => void;
  onAdd: () => void;
}) {
  const derived = calcIntervalName(noteA.trim(), noteB.trim());
  const ready = !!noteA.trim() && !!noteB.trim() && !!derived;
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
      <AutocompleteInput value={noteA} onChange={setNoteA} candidates={ALL_PITCHES} placeholder="音A，如 C4" />
      <span style={{ color: '#9ca3af', whiteSpace: 'nowrap' }}>+</span>
      <AutocompleteInput value={noteB} onChange={setNoteB} candidates={ALL_PITCHES} placeholder="音B，如 G4" />
      <span style={{ color: '#9ca3af', whiteSpace: 'nowrap' }}>=</span>
      <AutocompleteInput
        value={intervalName} onChange={setIntervalName} candidates={ALL_INTERVALS}
        placeholder={derived ?? '音程名称'}
        onKeyDown={(e) => e.key === 'Enter' && onAdd()}
      />
      <span style={{ color: derived ? '#059669' : '#9ca3af', fontWeight: derived ? 'bold' : 'normal', fontSize: '0.9rem' }}>
        {derived ? `(自动: ${derived})` : '—'}
      </span>
      <button onClick={onAdd} disabled={!ready} style={{
        padding: '12px 24px', borderRadius: '8px', border: 'none', whiteSpace: 'nowrap',
        background: ready ? '#3b82f6' : '#94a3b8', color: 'white', fontWeight: 'bold',
        cursor: ready ? 'pointer' : 'not-allowed',
      }}>+ 添加到素材池</button>
    </div>
  );
}

const TYPE_OPTIONS = [
  { value: 'notes',    label: '单音',           placeholder: '输入音高，如 C4、F#5、Bb3' },
  { value: 'symbols',  label: '音乐表情记号',   placeholder: '输入符号名称，如 ff、staccato、fermata' },
  { value: 'theory',   label: '双音/音程关系',  placeholder: '格式: 音符1,音符2|名称，如 C4,G4|纯五度 (P5)' },
  { value: 'patterns', label: '音型',           placeholder: '输入音型描述，如 上行音阶 C-D-E-F-G' },
];

export default function ManualCreator() {
  const addSlices = useAppStore(state => state.addSlices);

  const [type, setType] = useState<'notes' | 'symbols' | 'theory' | 'patterns'>('notes');
  const [content, setContent] = useState('');
  const [symbolAnswer, setSymbolAnswer] = useState('');
  // C 类分步字段
  const [noteA, setNoteA] = useState('');
  const [noteB, setNoteB] = useState('');
  const [intervalName, setIntervalName] = useState('');
  const [intervalPlacement, setIntervalPlacement] = useState<StaffPlacement>('auto');
  const [difficulty, setDifficulty] = useState(1);
  const [distractors, setDistractors] = useState('');
  const [batchMode, setBatchMode] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [result, setResult] = useState<{ msg: string; added: string[]; skipped: string[] } | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [placement, setPlacement] = useState<StaffPlacement>('auto');
  const previewRef = useRef<HTMLDivElement>(null);
  const intervalPreviewRef = useRef<HTMLDivElement>(null);

  // ── 单音大谱表预览 ──
  const isValidPitch = (s: string) => /^[A-Ga-g][#b]?\d$/.test(s);

  useEffect(() => {
    if (!previewRef.current || type !== 'notes') return;
    previewRef.current.innerHTML = '';

    const pitch = content.trim();
    if (!isValidPitch(pitch)) return;

    const renderer = new Renderer(previewRef.current, Renderer.Backends.SVG);
    const width = Math.min(400, previewRef.current.clientWidth - 20);
    renderer.resize(width, 240);
    const context = renderer.getContext();
    const staveW = width - 40;

    const staveTop = new Stave(10, 20, staveW);
    staveTop.addClef('treble');
    staveTop.setContext(context).draw();

    const staveBottom = new Stave(10, 110, staveW);
    staveBottom.addClef('bass');
    staveBottom.setContext(context).draw();

    const connector = new StaveConnector(staveTop, staveBottom);
    connector.setType(StaveConnector.type.BRACE);
    connector.setContext(context).draw();

    const actualPlacement = resolvePlacement(pitch, placement);
    const activeStave = actualPlacement === 'treble' ? staveTop : staveBottom;

    const match = pitch.match(/^([A-Ga-g])(#|b)?(\d)$/);
    if (!match) return;
    const key = `${match[1].toLowerCase()}/${match[3]}`;
    const accidental = match[2] || null;

    try {
      const note = new StaveNote({ keys: [key], duration: 'w', clef: actualPlacement });
      if (accidental) note.addModifier(new Accidental(accidental));

      const voice = new Voice({ numBeats: 4, beatValue: 4 });
      voice.setMode(2);
      voice.addTickables([note]);
      new Formatter().joinVoices([voice]).format([voice], 300);
      voice.draw(context, activeStave);
    } catch (e) {
      console.error('Preview error:', e);
    }
  }, [type, content, placement]);

  // ── 双音大谱表预览 ──
  useEffect(() => {
    if (!intervalPreviewRef.current || type !== 'theory') return;
    intervalPreviewRef.current.innerHTML = '';

    const noteAVal = noteA.trim();
    const noteBVal = noteB.trim();
    if (!isValidPitch(noteAVal) || !isValidPitch(noteBVal)) return;

    const renderer = new Renderer(intervalPreviewRef.current, Renderer.Backends.SVG);
    const width = Math.min(400, intervalPreviewRef.current.clientWidth - 20);
    renderer.resize(width, 260);
    const context = renderer.getContext();
    const staveW = width - 40;

    const staveTop = new Stave(10, 30, staveW);
    staveTop.addClef('treble');
    staveTop.setContext(context).draw();

    const staveBottom = new Stave(10, 130, staveW);
    staveBottom.addClef('bass');
    staveBottom.setContext(context).draw();

    const connector = new StaveConnector(staveTop, staveBottom);
    connector.setType(StaveConnector.type.BRACE);
    connector.setContext(context).draw();

    const actualPlacement = resolvePlacement(noteAVal, intervalPlacement);
    const activeStave = actualPlacement === 'treble' ? staveTop : staveBottom;

    try {
      const parsePitch = (p: string) => {
        const m = p.match(/^([A-Ga-g])(#|b)?(\d)$/);
        return m ? { key: `${m[1].toLowerCase()}/${m[3]}`, accidental: m[2] || null } : null;
      };
      const parsedA = parsePitch(noteAVal);
      const parsedB = parsePitch(noteBVal);

      if (parsedA && parsedB) {
        const stemDir = resolveStemDirection(parsedA.key, parsedB.key, actualPlacement);
        if (noteAVal === noteBVal) {
          const vfNotes = [0, 1].map(() => {
            const note = new StaveNote({ keys: [parsedA.key], duration: 'w', clef: actualPlacement, stemDirection: stemDir });
            if (parsedA.accidental) note.addModifier(new Accidental(parsedA.accidental));
            return note;
          });
          const voice = new Voice({ numBeats: 8, beatValue: 4 });
          voice.setMode(2);
          voice.addTickables(vfNotes);
          new Formatter().joinVoices([voice]).format([voice], 50);
          voice.draw(context, activeStave);
        } else {
          const note1 = new StaveNote({ keys: [parsedA.key], duration: 'h', clef: actualPlacement, stemDirection: stemDir });
          if (parsedA.accidental) note1.addModifier(new Accidental(parsedA.accidental));

          const note2 = new StaveNote({ keys: [parsedB.key], duration: 'h', clef: actualPlacement, stemDirection: stemDir });
          if (parsedB.accidental) note2.addModifier(new Accidental(parsedB.accidental));

          const voice = new Voice({ numBeats: 4, beatValue: 4 });
          voice.setMode(2);
          voice.addTickables([note1, note2]);
          new Formatter().joinVoices([voice]).format([voice], 280);
          voice.draw(context, activeStave);
        }
      }
    } catch (e) {
      console.error('Interval Preview error:', e);
    }
  }, [type, noteA, noteB, intervalPlacement]);

  const currentTypeOption = TYPE_OPTIONS.find(t => t.value === type)!;

  const parseDistractors = (raw: string): string[] | undefined => {
    const parts = raw.split('|').map(s => s.trim()).filter(Boolean);
    return parts.length > 0 ? parts : undefined;
  };

  const handleAddSingle = () => {
    let sliceContent: object;
    let idKey: string;
    const opts = parseDistractors(distractors);

    if (type === 'theory') {
      if (!noteA.trim() || !noteB.trim()) return;
      const derivedInterval = calcIntervalName(noteA.trim(), noteB.trim()) || intervalName.trim();
      if (!derivedInterval) return;
      const raw = `${noteA.trim()},${noteB.trim()}|${derivedInterval}`;
      const finalPlacement = intervalPlacement === 'auto'
        ? resolvePlacement(noteA.trim(), intervalPlacement)
        : intervalPlacement;
      const intervalContent: IntervalContent = {
        noteA: noteA.trim(),
        noteB: noteB.trim(),
        theory: intervalName.trim() || derivedInterval,
        placement: finalPlacement,
        raw,
        ...(opts && { options: [intervalName.trim() || derivedInterval, ...opts] }),
      };
      sliceContent = intervalContent;
      idKey = raw;
    } else {
      if (!content.trim()) return;
      if (type === 'symbols' && !symbolAnswer.trim()) return;
      const base = buildContent(type, content.trim());
      const correct = type === 'symbols' ? symbolAnswer.trim()
        : type === 'notes' ? content.trim()
        : content.trim();
      sliceContent = opts ? { ...base, options: [correct, ...opts] } : base;
      idKey = content.trim();
    }

    const { added, skipped } = addSlices([{ id: `manual_${type}_${Date.now()}_${idKey}`, module: type, content: sliceContent as any, difficulty }]);
    setContent(''); setSymbolAnswer(''); setNoteA(''); setNoteB(''); setIntervalName(''); setDistractors('');
    showResult(added, skipped);
  };

  const handleAddBatch = () => {
    if (!batchText.trim()) return;

    const lines = batchText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let currentPlacement = placement;
    let currentTheoryPlacement = intervalPlacement;
    const slices = [];

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];

      // Section markers for staff placement
      if (line === '[高音]') { currentPlacement = 'treble'; currentTheoryPlacement = 'treble'; continue; }
      if (line === '[低音]') { currentPlacement = 'bass'; currentTheoryPlacement = 'bass'; continue; }
      if (line === '[自动]') { currentPlacement = 'auto'; currentTheoryPlacement = 'auto'; continue; }

      let contentObj;
      if (type === 'symbols' && line.includes('|')) {
        const parts = line.split('|').map(s => s.trim());
        const [symbol, answer, ...dists] = parts;
        contentObj = { symbol, answer, ...(dists.length > 0 && { options: [answer, ...dists] }) };
      } else if (type === 'theory') {
        if (line.includes('|')) {
          const parts = line.split('|').map(s => s.trim());
          const notesPart = parts[0];
          const theory = parts[1] || '';
          const dists = parts.slice(2);
          const noteParts = notesPart.split(',').map(s => s.trim()).filter(Boolean);
          if (noteParts.length >= 2) {
            const noteA = noteParts[0];
            const noteB = noteParts[1];
            const raw = `${noteA},${noteB}|${theory}`;
            const finalPlacement = currentTheoryPlacement === 'auto'
              ? resolvePlacement(noteA, 'auto')
              : currentTheoryPlacement;
            contentObj = {
              noteA, noteB, theory, placement: finalPlacement, raw,
              ...(dists.length > 0 && { options: [theory, ...dists] }),
            } as IntervalContent;
          } else {
            contentObj = buildContent(type, line);
          }
        } else {
          contentObj = buildContent(type, line);
        }
      } else if (line.includes('|')) {
        // notes / patterns: pitch|answer|distractor1|distractor2...
        const parts = line.split('|').map(s => s.trim());
        const value = parts[0];
        const dists = parts.slice(1);
        const base = buildContent(type, value);
        contentObj = dists.length > 0 ? { ...base, options: [parts[1], ...parts.slice(2)] } : base;
        // override line for placement resolution below
        if (type === 'notes') {
          contentObj = { ...contentObj, placement: resolvePlacement(value, currentPlacement) };
        }
        slices.push({
          id: `manual_${type}_${Date.now()}_${idx}_${value}`,
          module: type,
          content: contentObj,
          difficulty
        });
        continue;
      } else {
        contentObj = buildContent(type, line);
      }

      // Override placement for batch Type A imports based on section markers
      if (type === 'notes') {
        contentObj = { ...contentObj, placement: resolvePlacement(line, currentPlacement) };
      }

      slices.push({
        id: `manual_${type}_${Date.now()}_${idx}_${line}`,
        module: type,
        content: contentObj,
        difficulty
      });
    }

    const { added, skipped } = addSlices(slices as any);
    setBatchText('');
    showResult(added, skipped);
  };

  const buildContent = (type: string, value: string) => {
    switch (type) {
      case 'notes': return { pitch: value, raw: value, placement: resolvePlacement(value, placement) };
      case 'symbols': return { symbol: value, answer: symbolAnswer.trim() };
      case 'theory': {
        if (value.includes('|')) {
          const [notesPart, theory] = value.split('|').map(s => s.trim());
          const notes = notesPart.split(',').map(s => s.trim()).filter(Boolean);
          return { theory, notes, raw: value, pattern: '' } as unknown as { theory: string; notes: string[]; raw: string; pattern: string };
        }
        // 旧格式：理论值作为 raw 字符串存储
        return { theory: value, notes: [], raw: value, pattern: '' } as unknown as { theory: string; notes: string[]; raw: string; pattern: string };
      }
      case 'patterns': return { pattern: value, raw: value } as { pattern: string; raw: string };
      default: return { raw: value } as unknown as { raw: string; pitch?: string; placement?: string; symbol?: string; answer?: string; theory?: string; notes?: string[]; pattern?: string };
    }
  };

  const sliceLabel = (s: { content: unknown }) => {
    const c = s.content as Record<string, unknown>;
    return String(c.raw || c.symbol || c.theory || c.pattern || '');
  };

  const showResult = (added: import('../../core/store/useAppStore').Slice[], skipped: import('../../core/store/useAppStore').Slice[]) => {
    const msg = added.length === 0
      ? `全部 ${skipped.length} 道题目已存在，未重复添加`
      : skipped.length === 0
        ? `已添加 ${added.length} 道题目`
        : `已添加 ${added.length} 道，${skipped.length} 道重复跳过`;
    setResult({ msg, added: added.map(sliceLabel), skipped: skipped.map(sliceLabel) });
    setShowDetail(false);
  };

  return (
    <div style={{ maxWidth: '800px' }}>
      <h1 style={{ fontSize: '2rem', color: '#1f2937', marginBottom: '10px' }}>手动出题器</h1>
      <p style={{ color: '#6b7280', marginBottom: '30px' }}>
        对于引擎无法自动识别的音型或乐理概念，教师可以在此手动创建题目并推送至素材池。
      </p>

      {/* 结果提示 */}
      {result && (
        <div style={{ background: result.skipped.length > 0 && result.added.length === 0 ? '#fef3c7' : '#ecfdf5', border: `1px solid ${result.skipped.length > 0 && result.added.length === 0 ? '#fcd34d' : '#6ee7b7'}`, borderRadius: '8px', marginBottom: '20px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px' }}>
            <span style={{ fontWeight: 'bold', color: result.skipped.length > 0 && result.added.length === 0 ? '#92400e' : '#065f46' }}>
              ✓ {result.msg}
            </span>
            {(result.added.length > 0 || result.skipped.length > 0) && (
              <button onClick={() => setShowDetail(v => !v)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#6b7280', textDecoration: 'underline' }}>
                {showDetail ? '收起' : '查看详情'}
              </button>
            )}
          </div>
          {showDetail && (
            <div style={{ borderTop: '1px solid #e5e7eb', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {result.added.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#065f46', marginBottom: '4px' }}>插入成功 ({result.added.length})</div>
                  {result.added.map((label, i) => (
                    <div key={i} style={{ fontSize: '0.85rem', color: '#1f2937', padding: '2px 0' }}>✓ {label}</div>
                  ))}
                </div>
              )}
              {result.skipped.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#92400e', marginBottom: '4px' }}>重复跳过 ({result.skipped.length})</div>
                  {result.skipped.map((label, i) => (
                    <div key={i} style={{ fontSize: '0.85rem', color: '#6b7280', padding: '2px 0' }}>— {label}</div>
                  ))}
                </div>
              )}
            </div>
          )}
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
            {type === 'theory' ? (
              <>
                <IntervalRow
                  noteA={noteA} setNoteA={setNoteA}
                  noteB={noteB} setNoteB={setNoteB}
                  intervalName={intervalName} setIntervalName={setIntervalName}
                  onAdd={handleAddSingle}
                />
                {/* 双音题目的谱号选择 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: '600' }}>谱表位置：</span>
                    <div style={{ display: 'flex', gap: '4px', background: 'white', borderRadius: '10px', padding: '3px' }}>
                      {([
                        { v: 'auto' as StaffPlacement, label: '自动' },
                        { v: 'treble' as StaffPlacement, label: '高音谱号' },
                        { v: 'bass' as StaffPlacement, label: '低音谱号' },
                      ]).map(opt => (
                        <button
                          key={opt.v}
                          onClick={() => setIntervalPlacement(opt.v)}
                          style={{
                            padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                            fontWeight: intervalPlacement === opt.v ? '700' : '500', fontSize: '0.85rem',
                            background: intervalPlacement === opt.v ? '#1f2937' : 'transparent',
                            color: intervalPlacement === opt.v ? 'white' : '#6b7280',
                            transition: 'all 0.15s'
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {/* 干扰项（可选） */}
                <input
                  value={distractors}
                  onChange={e => setDistractors(e.target.value)}
                  placeholder="干扰项（可选），用 | 分隔，如 大三度 (M3)|小三度 (m3)|纯四度 (P4)"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </>
            ) : (
              // A / B / D 类型
              <>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <AutocompleteInput
                    value={content} onChange={setContent}
                    candidates={type === 'notes' ? ALL_PITCHES : type === 'symbols' ? Object.keys(SYMBOL_MAP) : ALL_PATTERNS}
                    placeholder={currentTypeOption.placeholder}
                    onKeyDown={(e) => e.key === 'Enter' && type !== 'symbols' && handleAddSingle()}
                  />
                  {type !== 'symbols' && (
                    <button onClick={handleAddSingle} disabled={!content.trim()} style={{
                      padding: '12px 24px', borderRadius: '8px', border: 'none', whiteSpace: 'nowrap',
                      background: content.trim() ? '#3b82f6' : '#94a3b8', color: 'white', fontWeight: 'bold',
                      cursor: content.trim() ? 'pointer' : 'not-allowed',
                    }}>+ 添加到素材池</button>
                  )}
                </div>
                {type === 'symbols' && (
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
                {/* 干扰项（可选） */}
                <input
                  value={distractors}
                  onChange={e => setDistractors(e.target.value)}
                  placeholder="干扰项（可选），用 | 分隔，如 弱 (piano)|中强 (mezzo-forte)|强 (forte)"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
                {/* 单音：谱号位置选择 */}
                {type === 'notes' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: '600' }}>在大谱表中出现位置：</span>
                    <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', borderRadius: '10px', padding: '3px' }}>
                      {([
                        { v: 'auto' as StaffPlacement, label: '自动' },
                        { v: 'treble' as StaffPlacement, label: '高音谱号' },
                        { v: 'bass' as StaffPlacement, label: '低音谱号' },
                      ]).map(opt => (
                        <button
                          key={opt.v}
                          onClick={() => setPlacement(opt.v)}
                          style={{
                            padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                            fontWeight: placement === opt.v ? '700' : '500', fontSize: '0.85rem',
                            background: placement === opt.v ? '#1f2937' : 'transparent',
                            color: placement === opt.v ? 'white' : '#6b7280',
                            transition: 'all 0.15s'
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          {/* 单音大谱表预览 */}
          {type === 'notes' && isValidPitch(content.trim()) && (
            <div style={{
              background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px',
              padding: '16px', marginBottom: '15px', textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '8px' }}>
                大谱表预览 — 音符出现在{resolvePlacement(content.trim(), placement) === 'treble' ? '高音谱号' : '低音谱号'}中
              </div>
              <div ref={previewRef}></div>
            </div>
          )}
          {/* 双音大谱表预览 */}
          {type === 'theory' && isValidPitch(noteA.trim()) && isValidPitch(noteB.trim()) && (
            <div style={{
              background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px',
              padding: '16px', marginBottom: '15px', textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '8px' }}>
                大谱表预览 — 双音显示在{resolvePlacement(noteA.trim(), intervalPlacement) === 'treble' ? '高音谱号' : '低音谱号'}中
              </div>
              <div ref={intervalPreviewRef}></div>
            </div>
          )}
          <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
            {type === 'symbols' ? '第一行输入符号（题面），第二行输入答案含义' : type === 'theory' ? '选择音A和音B，系统自动计算并显示音程名称（可编辑）' : '按回车可快速提交'}
          </p>
        </div>
      ) : (
        <div>
          <textarea
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            placeholder={
              type === 'symbols'
                ? `每行格式: 符号|答案|干扰1|干扰2|干扰3（干扰项可选）\n例如：\npp|极弱 (pianissimo)|弱 (piano)|中弱 (mezzo-piano)|中强 (mezzo-forte)\nff|极强 (fortissimo)\nstaccato|断音 (staccato)`
                : type === 'theory'
                ? `每行格式: 音A,音B|答案|干扰1|干扰2|干扰3（干扰项可选）\n答案可以是任意维度：音程名、方向、级进/跳进等\n可用 [高音] [低音] [自动] 标记谱表\n例如：\n[高音]\nC4,G4|纯五度 (P5)|大五度|小五度|增五度\nC4,D4|上行|下行\nC4,D4|级进|跳进\nD4,E4|大三度 (M3)\n[低音]\nA2,B2|大二度 (M2)`
                : type === 'notes'
                ? `每行格式: 音高|答案|干扰1|干扰2|干扰3（干扰项可选）\n可用 [高音] [低音] [自动] 标记谱表\n例如：\n[高音]\nC4|C|D|E|F\nD4\n[低音]\nA2|A|G|B|C`
                : `每行格式: 音型|答案|干扰1|干扰2|干扰3（干扰项可选）\n例如：\n上行音阶跑动|上行音阶跑动|下行音阶跑动|分解和弦|琶音上行\n分解和弦`
            }
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
