import { useState, useRef, useEffect } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, StaveConnector, Stem } from 'vexflow';
import { useAppStore } from '../../core/store/useAppStore';
import { resolvePlacement } from '../../core/engine/pitchUtils';
import type { StaffPlacement } from '../../core/engine/pitchUtils';
import { analyzeChord } from '../../core/engine/chordAnalyzer';

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
  '纯四度 (P4)', '增四度 (A4)', '减五度 (d5)', '纯五度 (P5)',
  '小六度 (m6)', '大六度 (M6)', '小七度 (m7)', '大七度 (M7)', '纯八度 (P8)',
];

// ── 和弦识别字典 ──────────────────────────────────────────────
const CHORD_ROOTS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const CHORD_ACCIDENTALS = ['', '#', 'b'];
const CHORD_QUALITIES = [
  { key: 'Major', label: '大三' },
  { key: 'Minor', label: '小三' },
  { key: 'Diminished', label: '减三' },
  { key: 'Augmented', label: '增三' },
  { key: 'Dom7', label: '属七' },
  { key: 'Maj7', label: '大七' },
  { key: 'Min7', label: '小七' },
];
const CHORD_INVERSIONS = [
  { key: 'root', label: '原位' },
  { key: '1st', label: '第一转位' },
  { key: '2nd', label: '第二转位' },
];
const CHORD_DISPLAY_MODES = [
  { key: 'block' as const, label: '柱式' },
  { key: 'arpeggio' as const, label: '分解' },
];

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

// 音名字母索引
const LETTER_IDX: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

// ( diatonicSteps, semitones ) → 音程名称
const INTERVAL_NAME_TABLE: Record<string, string> = {
  '0,0': '纯一度 (P1)', '0,1': '增一度 (A1)',
  '1,0': '减二度 (d2)', '1,1': '小二度 (m2)', '1,2': '大二度 (M2)', '1,3': '增二度 (A2)',
  '2,2': '减三度 (d3)', '2,3': '小三度 (m3)', '2,4': '大三度 (M3)', '2,5': '增三度 (A3)',
  '3,4': '减四度 (d4)', '3,5': '纯四度 (P4)', '3,6': '增四度 (A4)',
  '4,6': '减五度 (d5)', '4,7': '纯五度 (P5)', '4,8': '增五度 (A5)',
  '5,7': '减六度 (d6)', '5,8': '小六度 (m6)', '5,9': '大六度 (M6)', '5,10': '增六度 (A6)',
  '6,9': '减七度 (d7)', '6,10': '小七度 (m7)', '6,11': '大七度 (M7)', '6,12': '增七度 (A7)',
  '7,11': '减八度 (d8)', '7,12': '纯八度 (P8)', '7,13': '增八度 (A8)',
};

// 计算两个音之间的音程名称
function calcIntervalName(noteA: string, noteB: string): string | null {
  const STEP_TO_SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  const parsePitch = (p: string) => {
    const m = p.match(/^([A-G])(#|b)?(\d)$/);
    if (!m) return null;
    const alter = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
    return { midi: STEP_TO_SEMI[m[1]] + alter + (parseInt(m[3]) + 1) * 12, letter: m[1], octave: parseInt(m[3]) };
  };

  const a = parsePitch(noteA);
  const b = parsePitch(noteB);
  if (!a || !b) return null;

  const semitones = Math.abs(b.midi - a.midi);
  // 确定高低音，保证 diatonic steps 非负
  const low = a.midi <= b.midi ? a : b;
  const high = a.midi <= b.midi ? b : a;
  const totalDiatonic = (high.octave - low.octave) * 7 + (LETTER_IDX[high.letter] - LETTER_IDX[low.letter]);
  const absDiatonic = Math.abs(totalDiatonic);
  const key = `${Math.min(absDiatonic, 7)},${semitones}`;
  return INTERVAL_NAME_TABLE[key] || null;
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
  { value: 'patterns', label: '音型/和弦',      placeholder: '输入音型描述，或进入和弦子模式使用快速选择' },
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
  const chordPreviewRef = useRef<HTMLDivElement>(null);

  // ── 和弦识别状态 ──
  const [chordEnabled] = useState(true);     // patterns 默认就是和弦模式
  const [chordInputMode, setChordInputMode] = useState<'quick' | 'custom'>('quick');
  const [chordRoot, setChordRoot] = useState('C');
  const [chordRootAcc, setChordRootAcc] = useState('');       // '' | '#' | 'b'
  const [chordRootOctave, setChordRootOctave] = useState(4);  // 根音八度
  const [chordQuality, setChordQuality] = useState('Major');
  const [chordInversion, setChordInversion] = useState('root');
  const [chordDisplayMode, setChordDisplayMode] = useState<'block' | 'arpeggio'>('block');
  const [chordQuickAnswer, setChordQuickAnswer] = useState('C');
  const [chordQuickNotes, setChordQuickNotes] = useState('C4, E4, G4');
  const [chordCustomPitches, setChordCustomPitches] = useState('');
  const [chordCustomAnswer, setChordCustomAnswer] = useState('');
  const [chordAnalysisResult, setChordAnalysisResult] = useState<string | null>(null);

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
          const note1 = new StaveNote({ keys: [parsedA.key], duration: 'h', clef: actualPlacement, stemDirection: stemDir });
          if (parsedA.accidental) note1.addModifier(new Accidental(parsedA.accidental));
          const note2 = new StaveNote({ keys: [parsedB.key], duration: 'h', clef: actualPlacement, stemDirection: stemDir });
          if (parsedB.accidental) note2.addModifier(new Accidental(parsedB.accidental));
          const voice = new Voice({ numBeats: 4, beatValue: 4 });
          voice.setMode(2);
          voice.addTickables([note1, note2]);
          new Formatter().joinVoices([voice]).format([voice], 280);
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

  /** Sync quick-select auto-generated answer + notes into editable fields. */
  function syncQuickChordFields(root: string, acc: string, quality: string, inversion: string, octave?: number) {
    const o = octave ?? chordRootOctave;
    setChordQuickAnswer(makeChordName(root, acc, quality));
    const notes = generateChordNotes(root, acc, quality, inversion, o);
    setChordQuickNotes(notes.join(', '));
  }

  // ── 和弦辅助函数 ──
  const LETTER_TO_SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const QUALITY_INTERVALS: Record<string, number[]> = {
    Major: [0, 4, 7], Minor: [0, 3, 7], Diminished: [0, 3, 6], Augmented: [0, 4, 8],
    Dom7: [0, 4, 7, 10], Maj7: [0, 4, 7, 11], Min7: [0, 3, 7, 10],
  };

  /** Generate chord note names from root + quality + inversion.
   *  @param rootOctave - the octave for the root note (default 4) */
  function generateChordNotes(root: string, acc: string, quality: string, inversion: string, rootOctave = 4): string[] {
    const intervals = QUALITY_INTERVALS[quality];
    if (!intervals) return [];
    const rootSemi = LETTER_TO_SEMI[root] ?? 0;
    const accAdj = acc === '#' ? 1 : acc === 'b' ? -1 : 0;
    // Use the provided octave; adjust downward if flat pushes into negative pitch class
    const startOctave = rootOctave + (accAdj < 0 && rootSemi + accAdj < 0 ? -1 : 0);

    const notes: string[] = intervals.map(semi => {
      const absoluteSemi = rootSemi + accAdj + semi;
      let octave = startOctave + Math.floor(absoluteSemi / 12);
      const noteSemi = ((absoluteSemi % 12) + 12) % 12;
      // Convert semitone to letter + accidental
      const SEMI_TO_NATURAL: [string, number][] = [
        ['C', 0], ['D', 2], ['E', 4], ['F', 5], ['G', 7], ['A', 9], ['B', 11],
      ];
      const [letter, natural] = SEMI_TO_NATURAL.find(([, n]) => n === noteSemi)
        ?? SEMI_TO_NATURAL.reduce((a, [l, n]) => Math.abs(n - noteSemi) < Math.abs(a[1] - noteSemi) ? [l, n] as [string, number] : a, ['C', 0] as [string, number]);
      const diff = noteSemi - natural;
      const noteAcc = diff === 0 ? '' : diff === 1 ? '#' : diff === 2 ? '##' : diff === -1 ? 'b' : diff === -2 ? 'bb' : '';
      // Adjust accidental display: prefer the "standard" spelling for this chord quality
      return `${letter}${noteAcc}${octave}`;
    });

    // Apply inversion
    if (inversion === '1st' && notes.length >= 2) {
      const first = notes.shift()!;
      const m = first.match(/(\d+)$/);
      const oct = m ? parseInt(m[1]) + 1 : 5;
      notes.push(first.replace(/\d+$/, String(oct)));
    } else if (inversion === '2nd' && notes.length >= 3) {
      const first = notes.shift()!;
      const second = notes.shift()!;
      const m1 = first.match(/(\d+)$/);
      const m2 = second.match(/(\d+)$/);
      const o1 = m1 ? parseInt(m1[1]) + 1 : 5;
      const o2 = m2 ? parseInt(m2[1]) + 1 : 5;
      notes.push(first.replace(/\d+$/, String(o1)));
      notes.push(second.replace(/\d+$/, String(o2)));
    }

    // Ensure accidentals use input accidental spelling for the root note
    return notes.map((n, i) => {
      if (i === 0 && acc) {
        const letterMatch = n.match(/^([A-G])/);
        if (letterMatch && letterMatch[1] === root) {
          return `${root}${acc}${n.replace(/^[A-G][#b]*/, '')}`;
        }
      }
      return n;
    });
  }

  /** Generate a human-readable chord name from root+acc+quality. */
  function makeChordName(root: string, acc: string, quality: string): string {
    const suffix: Record<string, string> = {
      Major: '', Minor: 'm', Diminished: 'dim', Augmented: 'aug',
      Dom7: '7', Maj7: 'maj7', Min7: 'm7',
    };
    return `${root}${acc}${suffix[quality] ?? quality}`;
  }

  // ── 和弦 VexFlow 预览 ──
  useEffect(() => {
    if (!chordPreviewRef.current || type !== 'patterns' || !chordEnabled) return;
    chordPreviewRef.current.innerHTML = '';

    let noteNames: string[] | undefined;

    if (chordInputMode === 'quick') {
      noteNames = chordQuickNotes.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
      if (noteNames.length < 2) {
        noteNames = generateChordNotes(chordRoot, chordRootAcc, chordQuality, chordInversion, chordRootOctave);
      }
    } else {
      const pitchList = chordCustomPitches.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
      if (pitchList.length >= 2) {
        noteNames = pitchList;
      }
    }

    if (!noteNames || noteNames.length < 2) return;

    const renderer = new Renderer(chordPreviewRef.current, Renderer.Backends.SVG);
    const width = Math.min(400, chordPreviewRef.current.clientWidth - 20);
    const height = 240;
    renderer.resize(width, height);
    const context = renderer.getContext();
    const staveW = width - 40;

    // 大谱表：高音 + 低音谱表
    const staveTop = new Stave(10, 20, staveW);
    staveTop.addClef('treble');
    staveTop.setContext(context).draw();

    const staveBottom = new Stave(10, 120, staveW);
    staveBottom.addClef('bass');
    staveBottom.setContext(context).draw();

    const connector = new StaveConnector(staveTop, staveBottom);
    connector.setType(StaveConnector.type.BRACE);
    connector.setContext(context).draw();

    // 根据音高选择谱表：取中位数判断
    const midiVals = noteNames.map(n => {
      const noteVal: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
      const m = n.match(/^([A-Ga-g])(#|b)?(\d+)$/);
      if (!m) return 60;
      const adj = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
      return noteVal[m[1].toUpperCase()] + adj + (parseInt(m[3]) + 1) * 12;
    });
    const avgMidi = midiVals.reduce((a, b) => a + b, 0) / midiVals.length;
    const clef = avgMidi >= 64 ? 'treble' : 'bass';  // E4=64
    const activeStave = clef === 'treble' ? staveTop : staveBottom;

    try {
      if (chordDisplayMode === 'block') {
        // Block chord: stacked notes
        const vfKeys = noteNames.map(n => {
          const m = n.match(/^([A-Ga-g])(#|b)?(\d+)$/);
          return m ? `${m[1].toLowerCase()}/${m[3]}` : 'c/4';
        });
        const chordNote = new StaveNote({ keys: vfKeys, duration: 'w', clef });
        noteNames.forEach(n => {
          const m = n.match(/^[A-Ga-g]((#|b)+)?\d+$/);
          if (m && m[1]) {
            chordNote.addModifier(new Accidental(m[1]), noteNames.indexOf(n));
          }
        });
        const voice = new Voice({ numBeats: 4, beatValue: 4 });
        voice.setMode(2);
        voice.addTickables([chordNote]);
        new Formatter().joinVoices([voice]).format([voice], 280);
        voice.draw(context, activeStave);
      } else {
        // Arpeggio: quarter note sequence
        const vfNotes = noteNames.map(n => {
          const m = n.match(/^([A-Ga-g])(#|b)?(\d+)$/);
          const key = m ? `${m[1].toLowerCase()}/${m[3]}` : 'c/4';
          const note = new StaveNote({ keys: [key], duration: 'q', clef });
          if (m && m[2]) note.addModifier(new Accidental(m[2]));
          return note;
        });
        const beats = vfNotes.length;
        const voice = new Voice({ numBeats: beats, beatValue: 4 });
        voice.setMode(2);
        voice.addTickables(vfNotes);
        new Formatter().joinVoices([voice]).format([voice], Math.min(360, beats * 60));
        voice.draw(context, activeStave);
      }
    } catch (e) {
      console.error('Chord preview error:', e);
    }
  }, [type, chordEnabled, chordInputMode, chordRoot, chordRootAcc, chordRootOctave, chordQuality, chordInversion, chordDisplayMode, chordCustomPitches, chordQuickNotes, chordQuickAnswer]);

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
      const answer = intervalName.trim() || derivedInterval;
      const intervalContent: IntervalContent = {
        noteA: noteA.trim(),
        noteB: noteB.trim(),
        theory: answer,
        placement: finalPlacement,
        raw,
        ...(opts && { options: opts.some(opt => opt === answer) ? opts : [answer, ...opts] }),
      };
      sliceContent = intervalContent;
      idKey = raw;
    } else if (type === 'patterns' && chordEnabled) {
      // ── 和弦模式 ──
      if (chordInputMode === 'quick') {
        let noteNames = chordQuickNotes.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
        if (noteNames.length < 2) {
          // 如果老师把音高删空了，fallback 自动生成
          noteNames = generateChordNotes(chordRoot, chordRootAcc, chordQuality, chordInversion, chordRootOctave);
        }
        const chordName = chordQuickAnswer.trim() || makeChordName(chordRoot, chordRootAcc, chordQuality);
        const raw = `${chordName} (${noteNames.join(',')})`;
        const chordContent = {
          pattern: '',
          raw,
          notes: noteNames,
          chordType: 'chord' as const,
          chordName,
          inversion: chordInversion,
          displayMode: chordDisplayMode,
          ...(opts && { options: opts.some(opt => opt === chordName) ? opts : [chordName, ...opts] }),
        };
        sliceContent = chordContent;
        idKey = raw;
      } else {
        const pitchList = chordCustomPitches.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
        if (pitchList.length < 2) return;
        const analysis = analyzeChord(pitchList);
        const chordName = chordCustomAnswer.trim() || analysis?.name || pitchList.join('+');
        const raw = `${chordName} (${pitchList.join(',')})`;
        const chordContent = {
          pattern: '',
          raw,
          notes: pitchList,
          chordType: 'chord' as const,
          chordName,
          inversion: analysis?.inversion ?? 'root',
          displayMode: chordDisplayMode,
          ...(opts && { options: opts.some(opt => opt === chordName) ? opts : [chordName, ...opts] }),
        };
        sliceContent = chordContent;
        idKey = raw;
      }
    } else {
      if (!content.trim()) return;
      if (type === 'symbols' && !symbolAnswer.trim()) return;
      const base = buildContent(type, content.trim());
      const correct = type === 'symbols' ? symbolAnswer.trim()
        : type === 'notes' ? content.trim()
        : content.trim();
      sliceContent = opts && opts.some(opt => opt === correct) ? { ...base, options: opts } : opts ? { ...base, options: [correct, ...opts] } : base;
      idKey = content.trim();
    }

    const { added, skipped } = addSlices([{ id: `manual_${type}_${Date.now()}_${idKey}`, module: type, content: sliceContent as any, difficulty }]);
    setContent(''); setSymbolAnswer(''); setNoteA(''); setNoteB(''); setIntervalName(''); setDistractors('');
    setChordCustomPitches('');
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
        const answerInDists = dists.some(d => d === answer);
        contentObj = { symbol, answer, ...(dists.length > 0 && { options: answerInDists ? dists : [answer, ...dists] }) };
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
            const answerInDists = dists.some(d => d === theory);
            contentObj = {
              noteA, noteB, theory, placement: finalPlacement, raw,
              ...(dists.length > 0 && { options: answerInDists ? dists : [theory, ...dists] }),
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
        const answer = parts[1] || value;
        const dists = parts.slice(2);

        // Detect chord batch: value is comma-separated pitches like "C4,E4,G4"
        const isChordBatch = type === 'patterns' && /^[A-G][#b]?\d(?:[,，\s]+[A-G][#b]?\d)+$/.test(value);

        let contentObj;
        if (isChordBatch) {
          const pitchList = value.split(/[,，\s]+/).filter(Boolean);
          const analysis = analyzeChord(pitchList);
          const chordName = answer;
          contentObj = {
            pattern: '',
            raw: `${chordName} (${pitchList.join(',')})`,
            notes: pitchList,
            chordType: 'chord',
            chordName,
            inversion: analysis?.inversion ?? 'root',
            displayMode: 'block',
          };
        } else {
          const base = buildContent(type, value);
          const answerInDists = dists.some(d => d === answer);
          contentObj = dists.length > 0 ? { ...base, options: answerInDists ? dists : [answer, ...dists] } : base;
        }
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
      case 'patterns': {
        // If chord mode is active, build chord content
        if (chordEnabled) {
          let noteNames: string[] = [];
          let chordName = '';
          let inv = 'root';
          let disp: 'block' | 'arpeggio' = 'block';
          if (chordInputMode === 'quick') {
            noteNames = chordQuickNotes.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
            if (noteNames.length < 2) {
              noteNames = generateChordNotes(chordRoot, chordRootAcc, chordQuality, chordInversion, chordRootOctave);
            }
            chordName = chordQuickAnswer.trim() || makeChordName(chordRoot, chordRootAcc, chordQuality);
            inv = chordInversion;
            disp = chordDisplayMode;
          } else {
            const pitchList = chordCustomPitches.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
            noteNames = pitchList;
            const analysis = analyzeChord(pitchList);
            chordName = chordCustomAnswer.trim() || analysis?.name || pitchList.join('+');
            inv = analysis?.inversion ?? 'root';
            disp = chordDisplayMode;
          }
          return {
            pattern: '',
            raw: `${chordName} (${noteNames.join(',')})`,
            notes: noteNames,
            chordType: 'chord' as const,
            chordName,
            inversion: inv,
            displayMode: disp,
          };
        }
        return { pattern: value, raw: value } as { pattern: string; raw: string };
      }
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
                {/* 指定选项（可选） */}
                <input
                  value={distractors}
                  onChange={e => setDistractors(e.target.value)}
                  placeholder="指定选项（可选），用 | 分隔，如 大三度 (M3)|小三度 (m3)|纯四度 (P4)|纯五度 (P5)"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '6px', lineHeight: '1.4' }}>
                  💡 提示：如果选项中包含正确答案，学生端会保留您配置的顺序；否则系统会打乱选项顺序以防作弊
                </div>
              </>
            ) : (
              // A / B / D 类型
              <>
                {type === 'patterns' ? (
                  <>
                    {/* 输入模式切换 */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.95rem', color: '#6b7280', fontWeight: 600, alignSelf: 'center' }}>方式：</span>
                      <button onClick={() => setChordInputMode('quick')} style={{ padding: '6px 16px', borderRadius: '8px', border: chordInputMode === 'quick' ? '2px solid #3b82f6' : '1px solid #d1d5db', background: chordInputMode === 'quick' ? '#eff6ff' : 'white', color: chordInputMode === 'quick' ? '#1d4ed8' : '#6b7280', cursor: 'pointer', fontWeight: chordInputMode === 'quick' ? 'bold' : 'normal', fontSize: '0.95rem' }}>
                        快速选择
                      </button>
                      <button onClick={() => setChordInputMode('custom')} style={{ padding: '6px 16px', borderRadius: '8px', border: chordInputMode === 'custom' ? '2px solid #3b82f6' : '1px solid #d1d5db', background: chordInputMode === 'custom' ? '#eff6ff' : 'white', color: chordInputMode === 'custom' ? '#1d4ed8' : '#6b7280', cursor: 'pointer', fontWeight: chordInputMode === 'custom' ? 'bold' : 'normal', fontSize: '0.95rem' }}>
                        自定义音高
                      </button>
                    </div>

                    {chordInputMode === 'quick' ? (
                      <>
                        {/* 根音 + 性质 并排（放不下会换行） */}
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                          <div style={{ flex: '1 1 200px', minWidth: '200px' }}>
                            <div style={{ fontSize: '0.95rem', color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}>根音</div>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {CHORD_ROOTS.map(r => (
                                <button key={r} onClick={() => { setChordRoot(r); syncQuickChordFields(r, chordRootAcc, chordQuality, chordInversion); }} style={{ width: '38px', padding: '6px 0', borderRadius: '6px', border: chordRoot === r && !chordRootAcc ? '2px solid #3b82f6' : '1px solid #d1d5db', background: chordRoot === r && !chordRootAcc ? '#eff6ff' : 'white', color: chordRoot === r && !chordRootAcc ? '#1d4ed8' : '#374151', cursor: 'pointer', fontWeight: chordRoot === r && !chordRootAcc ? 'bold' : 'normal', fontSize: '0.95rem' }}>
                                  {r}
                                </button>
                              ))}
                            </div>
                            <div style={{ display: 'flex', gap: '4px', marginTop: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                              {CHORD_ACCIDENTALS.map(a => (
                                <button key={a || 'natural'} onClick={() => { setChordRootAcc(a); syncQuickChordFields(chordRoot, a, chordQuality, chordInversion); }} style={{ padding: '4px 12px', borderRadius: '6px', border: chordRootAcc === a ? '2px solid #3b82f6' : '1px solid #d1d5db', background: chordRootAcc === a ? '#eff6ff' : 'white', color: chordRootAcc === a ? '#1d4ed8' : '#6b7280', cursor: 'pointer', fontWeight: chordRootAcc === a ? 'bold' : 'normal', fontSize: '0.9rem' }}>
                                {a === '' ? '♮' : a === '#' ? '♯' : '♭'}
                              </button>
                              ))}
                              <span style={{ marginLeft: '8px', fontSize: '0.9rem', color: '#6b7280', fontWeight: 600 }}>八度</span>
                              {[3, 4, 5].map(o => (
                                <button key={o} onClick={() => { setChordRootOctave(o); syncQuickChordFields(chordRoot, chordRootAcc, chordQuality, chordInversion, o); }} style={{ width: '32px', padding: '4px 0', borderRadius: '6px', border: chordRootOctave === o ? '2px solid #3b82f6' : '1px solid #d1d5db', background: chordRootOctave === o ? '#eff6ff' : 'white', color: chordRootOctave === o ? '#1d4ed8' : '#6b7280', cursor: 'pointer', fontWeight: chordRootOctave === o ? 'bold' : 'normal', fontSize: '0.9rem' }}>
                                  {o}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div style={{ flex: '1 1 200px', minWidth: '200px' }}>
                            <div style={{ fontSize: '0.95rem', color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}>性质</div>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
                              {CHORD_QUALITIES.slice(0, 4).map(q => (
                                <button key={q.key} onClick={() => { setChordQuality(q.key); syncQuickChordFields(chordRoot, chordRootAcc, q.key, chordInversion); }} style={{ padding: '6px 14px', borderRadius: '6px', border: chordQuality === q.key ? '2px solid #3b82f6' : '1px solid #d1d5db', background: chordQuality === q.key ? '#eff6ff' : 'white', color: chordQuality === q.key ? '#1d4ed8' : '#374151', cursor: 'pointer', fontWeight: chordQuality === q.key ? 'bold' : 'normal', fontSize: '0.9rem' }}>
                                  {q.label}
                                </button>
                              ))}
                            </div>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {CHORD_QUALITIES.slice(4).map(q => (
                                <button key={q.key} onClick={() => { setChordQuality(q.key); syncQuickChordFields(chordRoot, chordRootAcc, q.key, chordInversion); }} style={{ padding: '6px 14px', borderRadius: '6px', border: chordQuality === q.key ? '2px solid #3b82f6' : '1px solid #d1d5db', background: chordQuality === q.key ? '#eff6ff' : 'white', color: chordQuality === q.key ? '#1d4ed8' : '#374151', cursor: 'pointer', fontWeight: chordQuality === q.key ? 'bold' : 'normal', fontSize: '0.9rem' }}>
                                  {q.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* 答案 + 音高 并排 */}
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                          <div style={{ flex: '1 1 180px', minWidth: '180px' }}>
                            <div style={{ fontSize: '0.95rem', color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}>答案</div>
                            <input value={chordQuickAnswer} onChange={e => setChordQuickAnswer(e.target.value)}
                              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box' }}
                              placeholder="C Major" />
                          </div>
                          <div style={{ flex: '1 1 180px', minWidth: '180px' }}>
                            <div style={{ fontSize: '0.95rem', color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}>音高</div>
                            <input value={chordQuickNotes} onChange={e => setChordQuickNotes(e.target.value)}
                              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box', fontFamily: 'monospace' }}
                              placeholder="C4, E4, G4" />
                          </div>
                        </div>

                        {/* 转位 + 显示 一行 */}
                        <div style={{ display: 'flex', gap: '16px', marginBottom: '8px', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: 600 }}>转位</span>
                            {CHORD_INVERSIONS.map(inv => (
                              <button key={inv.key} onClick={() => { setChordInversion(inv.key); syncQuickChordFields(chordRoot, chordRootAcc, chordQuality, inv.key); }} style={{ padding: '5px 12px', borderRadius: '6px', border: chordInversion === inv.key ? '2px solid #3b82f6' : '1px solid #d1d5db', background: chordInversion === inv.key ? '#eff6ff' : 'white', color: chordInversion === inv.key ? '#1d4ed8' : '#6b7280', cursor: 'pointer', fontSize: '0.9rem' }}>
                                {inv.label}
                              </button>
                            ))}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: 600 }}>显示</span>
                            {CHORD_DISPLAY_MODES.map(m => (
                              <button key={m.key} onClick={() => setChordDisplayMode(m.key)} style={{ padding: '5px 12px', borderRadius: '6px', border: chordDisplayMode === m.key ? '2px solid #3b82f6' : '1px solid #d1d5db', background: chordDisplayMode === m.key ? '#eff6ff' : 'white', color: chordDisplayMode === m.key ? '#1d4ed8' : '#6b7280', cursor: 'pointer', fontSize: '0.9rem' }}>
                                {m.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <AutocompleteInput
                          value={chordCustomPitches}
                          onChange={v => {
                            setChordCustomPitches(v);
                            setChordCustomAnswer('');
                            const pitchList = v.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
                            if (pitchList.length >= 2) {
                              const analysis = analyzeChord(pitchList);
                              setChordAnalysisResult(analysis?.name ?? '无法识别');
                              if (analysis) { setChordCustomAnswer(analysis.name); }
                            } else { setChordAnalysisResult(null); }
                          }}
                          candidates={ALL_PITCHES}
                          placeholder="C4, E4, G4（逗号或空格分隔）"
                        />
                        {chordAnalysisResult && (
                          <div style={{ marginTop: '6px', padding: '8px 12px', borderRadius: '8px', background: chordAnalysisResult === '无法识别' ? '#fef3c7' : '#ecfdf5', border: `1px solid ${chordAnalysisResult === '无法识别' ? '#fcd34d' : '#6ee7b7'}`, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ color: chordAnalysisResult === '无法识别' ? '#92400e' : '#065f46', fontSize: '0.9rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {chordAnalysisResult === '无法识别' ? '⚠️ 无法识别' : '✓ 自动识别'}
                            </span>
                            <input value={chordCustomAnswer} onChange={e => setChordCustomAnswer(e.target.value)}
                              placeholder={chordAnalysisResult === '无法识别' ? '手动输入和弦名' : chordAnalysisResult}
                              style={{ flex: 1, minWidth: '140px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem', background: 'white', color: '#1f2937' }} />
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '4px', marginTop: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: 600 }}>显示</span>
                          {CHORD_DISPLAY_MODES.map(m => (
                            <button key={m.key} onClick={() => setChordDisplayMode(m.key)} style={{ padding: '5px 12px', borderRadius: '6px', border: chordDisplayMode === m.key ? '2px solid #3b82f6' : '1px solid #d1d5db', background: chordDisplayMode === m.key ? '#eff6ff' : 'white', color: chordDisplayMode === m.key ? '#1d4ed8' : '#6b7280', cursor: 'pointer', fontSize: '0.9rem' }}>
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {/* 指定选项 */}
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}>选项自定义（| 分隔，留空自动生成）</div>
                      <input value={distractors} onChange={e => setDistractors(e.target.value)}
                        placeholder="C Major|A Minor|G7"
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box' }} />
                    </div>

                    {/* 预览 */}
                    {(chordInputMode === 'quick' || chordCustomPitches.trim()) && (
                      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '12px', marginBottom: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '6px' }}>
                          {chordDisplayMode === 'block' ? '柱式和弦预览' : '分解和弦预览'} — {chordInputMode === 'quick' ? chordQuickAnswer : chordCustomAnswer || chordAnalysisResult || ''}
                        </div>
                        <div ref={chordPreviewRef}></div>
                      </div>
                    )}

                    <button onClick={handleAddSingle} style={{
                      padding: '12px 24px', borderRadius: '8px', border: 'none', width: '100%',
                      background: (chordInputMode === 'quick' || chordCustomPitches.trim().split(/[,，\s]+/).filter(Boolean).length >= 2) ? '#3b82f6' : '#94a3b8',
                      color: 'white', fontWeight: 'bold', cursor: (chordInputMode === 'quick' || chordCustomPitches.trim().split(/[,，\s]+/).filter(Boolean).length >= 2) ? 'pointer' : 'not-allowed', fontSize: '0.95rem',
                    }}>+ 添加到素材池</button>
                  </>
                ) : (
                  <>
                    {/* A / B 类型 */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <AutocompleteInput
                        value={content} onChange={setContent}
                        candidates={type === 'notes' ? ALL_PITCHES : type === 'symbols' ? Object.keys(SYMBOL_MAP) : []}
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
                  </>
                )}

                {type !== 'patterns' && (
                  <>
                    <input
                      value={distractors}
                      onChange={e => setDistractors(e.target.value)}
                      placeholder="指定选项（可选），用 | 分隔，如 C Major|A Minor|G7"
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box' }}
                    />
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '6px', marginBottom: '10px', lineHeight: '1.4' }}>
                      💡 提示：如果选项中包含正确答案，学生端会保留您配置的顺序；否则系统会打乱选项顺序以防作弊
                    </div>
                  </>
                )}
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
                ? `每行格式: 符号|答案|选项2|选项3|选项4（指定选项可选）\n例如：\npp|极弱 (pianissimo)|弱 (piano)|中弱 (mezzo-piano)|中强 (mezzo-forte)\nff|极强 (fortissimo)\nstaccato|断音 (staccato)`
                : type === 'theory'
                ? `每行格式: 音A,音B|答案|选项2|选项3|选项4（指定选项可选）\n答案可以是任意维度：音程名、方向、级进/跳进等\n可用 [高音] [低音] [自动] 标记谱表\n例如：\n[高音]\nC4,G4|纯五度 (P5)|大五度|小五度|增五度\nC4,D4|上行|下行\nC4,D4|级进|跳进\nD4,E4|大三度 (M3)\n[低音]\nA2,B2|大二度 (M2)`
                : type === 'notes'
                ? `每行格式: 音高|答案|选项2|选项3|选项4（指定选项可选）\n可用 [高音] [低音] [自动] 标记谱表\n例如：\n[高音]\nC4|C|D|E|F\nD4\n[低音]\nA2|A|G|B|C`
                : type === 'patterns'
                ? `和弦格式：C4,E4,G4|C Major|F Major|A Minor|G Major\n音型格式：上行音阶跑动|上行音阶跑动|下行音阶跑动|分解和弦|琶音上行`
                : `每行格式: 音型|答案|选项2|选项3|选项4（指定选项可选）\n例如：\n上行音阶跑动|上行音阶跑动|下行音阶跑动|分解和弦|琶音上行\n分解和弦`
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
