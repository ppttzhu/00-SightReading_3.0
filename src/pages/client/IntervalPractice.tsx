import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'vexflow';
import { NOTES_INPUT_MODE_KEY } from './StageSelector';

// ============================================================
// 音程数据
// ============================================================

const INTERVAL_TYPE_SEMITONES: Record<string, number[]> = {
  '一度': [0],
  '二度': [1, 2],
  '三度': [3, 4],
  '四度': [5, 6],
  '五度': [6, 7],
  '六度': [8, 9],
  '七度': [10, 11],
  '八度': [12],
};

const SEMITONE_TO_NAMES: Record<number, string[]> = {
  0: ['纯一度 (P1)'],
  1: ['小二度 (m2)'],
  2: ['大二度 (M2)'],
  3: ['小三度 (m3)'],
  4: ['大三度 (M3)'],
  5: ['纯四度 (P4)'],
  6: ['三全音 (TT)', '增四度 (A4)', '减五度 (d5)'],
  7: ['纯五度 (P5)'],
  8: ['小六度 (m6)'],
  9: ['大六度 (M6)'],
  10: ['小七度 (m7)'],
  11: ['大七度 (M7)'],
  12: ['纯八度 (P8)'],
};

const ALL_INTERVAL_NAMES = Object.values(SEMITONE_TO_NAMES).flat();

const INTERVAL_GROUPS: Record<string, string[]> = {
  '一度': ['纯一度 (P1)'],
  '二度': ['小二度 (m2)', '大二度 (M2)'],
  '三度': ['小三度 (m3)', '大三度 (M3)'],
  '四度': ['纯四度 (P4)', '增四度 (A4)'],
  '五度': ['纯五度 (P5)', '减五度 (d5)'],
  '六度': ['小六度 (m6)', '大六度 (M6)'],
  '七度': ['小七度 (m7)', '大七度 (M7)'],
  '八度': ['纯八度 (P8)'],
};

const ADJACENT_GROUPS: Record<string, string[]> = {
  '一度': ['二度'],
  '二度': ['一度', '三度'],
  '三度': ['二度', '四度'],
  '四度': ['三度', '五度'],
  '五度': ['四度', '六度'],
  '六度': ['五度', '七度'],
  '七度': ['六度', '八度'],
  '八度': ['七度'],
};

// ============================================================
// 音高转换工具
// ============================================================

const C2_MIDI = 36;
const C7_MIDI = 96;
const WHITE_KEY_MIDI_MOD = new Set([0, 2, 4, 5, 7, 9, 11]);
const E4_MIDI = 64;
const A3_MIDI = 57;

function isWhiteKeyMidi(midi: number): boolean {
  return WHITE_KEY_MIDI_MOD.has(((midi % 12) + 12) % 12);
}

function midiToPitch(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const idx = ((midi % 12) + 12) % 12;
  return `${names[idx]}${octave}`;
}

function parsePitchForVexflow(pitchStr: string): { key: string; accidental: string | null } {
  const match = pitchStr.match(/^([A-Ga-g])(#|b)?(\d)$/);
  if (!match) return { key: 'c/4', accidental: null };
  return {
    key: `${match[1].toLowerCase()}/${match[3]}`,
    accidental: match[2] || null
  };
}

function getClef(lowMidi: number, highMidi: number, clefPref: string): string {
  if (clefPref === '高音谱号') return 'treble';
  if (clefPref === '低音谱号') return 'bass';
  const mid = (lowMidi + highMidi) / 2;
  if (mid >= E4_MIDI) return 'treble';
  if (mid <= A3_MIDI) return 'bass';
  return Math.random() > 0.5 ? 'treble' : 'bass';
}

// ============================================================
// 音程生成
// ============================================================

interface IntervalQuestion {
  lowPitch: string;
  highPitch: string;
  lowMidi: number;
  highMidi: number;
  semitones: number;
  intervalName: string;
  clef: string;
  isHarmonic: boolean;
}

function generateInterval(
  type: string,
  direction: string,
  clefPref: string,
  modePref: string
): IntervalQuestion {
  // 1. Determine semitones
  let semitones: number;
  if (type === '随机') {
    do {
      semitones = Math.floor(Math.random() * 12) + 1;
    } while (semitones === 6 && Math.random() > 0.5); // occasionally skip tritone for variety
  } else {
    const options = INTERVAL_TYPE_SEMITONES[type];
    semitones = options[Math.floor(Math.random() * options.length)];
  }

  // 2. Determine direction
  let dir: number;
  if (direction === '上行') dir = 1;
  else if (direction === '下行') dir = -1;
  else dir = Math.random() > 0.5 ? 1 : -1;

  // 3. Determine mode
  let isHarmonic: boolean;
  if (modePref === '和声音程') isHarmonic = true;
  else if (modePref === '旋律音程') isHarmonic = false;
  else isHarmonic = Math.random() > 0.5;

  // 4. Compute valid starting range (ensure target stays in C2-C7)
  const minStart = dir === 1 ? C2_MIDI : C2_MIDI + semitones;
  const maxStart = dir === 1 ? C7_MIDI - semitones : C7_MIDI;

  // 5. Pick random white-key starting MIDI
  let startMidi = 60; // fallback C4
  let attempts = 0;
  while (attempts < 100) {
    const candidate = minStart + Math.floor(Math.random() * (maxStart - minStart + 1));
    if (isWhiteKeyMidi(candidate)) {
      startMidi = candidate;
      break;
    }
    attempts++;
  }

  // 6. Compute target
  const targetMidi = startMidi + dir * semitones;

  // 7. Build result
  const startPitch = midiToPitch(startMidi);
  const targetPitch = midiToPitch(targetMidi);
  const lowMidi = Math.min(startMidi, targetMidi);
  const highMidi = Math.max(startMidi, targetMidi);

  return {
    lowPitch: lowMidi === startMidi ? startPitch : targetPitch,
    highPitch: highMidi === startMidi ? startPitch : targetPitch,
    lowMidi,
    highMidi,
    semitones,
    intervalName: (SEMITONE_TO_NAMES[semitones] || [`${semitones}半音`])[Math.floor(Math.random() * (SEMITONE_TO_NAMES[semitones]?.length || 1))],
    clef: getClef(lowMidi, highMidi, clefPref),
    isHarmonic,
  };
}

// ============================================================
// 选项生成
// ============================================================

function generateOptions(question: IntervalQuestion, type: string): string[] {
  const correct = question.intervalName;

  // Determine which degree group the correct answer belongs to
  let correctDegree: string | null = null;
  for (const [degree, names] of Object.entries(INTERVAL_GROUPS)) {
    if (names.includes(correct)) {
      correctDegree = degree;
      break;
    }
  }

  const distractors: string[] = [];

  if (type === '随机') {
    // Force at least one distractor to share the same degree, so the user
    // must discriminate quality (e.g. 大三度 vs 小三度), not just degree.
    if (correctDegree) {
      const siblings = (INTERVAL_GROUPS[correctDegree] || []).filter(n => n !== correct);
      if (siblings.length > 0) {
        distractors.push(siblings[Math.floor(Math.random() * siblings.length)]);
      }
    }
    const remaining = ALL_INTERVAL_NAMES.filter(n => n !== correct && !distractors.includes(n));
    distractors.push(...remaining.sort(() => Math.random() - 0.5).slice(0, 3 - distractors.length));
  } else {
    const group = INTERVAL_GROUPS[type] || [];
    const adjacentNames = (ADJACENT_GROUPS[type] || []).flatMap(g => INTERVAL_GROUPS[g] || []);
    const pool = [...new Set([...group, ...adjacentNames])];
    distractors.push(...pool
      .filter(p => p !== correct)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3));
  }

  // Fallback
  while (distractors.length < 3) {
    const fallback = ALL_INTERVAL_NAMES.filter(n => n !== correct && !distractors.includes(n));
    if (fallback.length === 0) break;
    distractors.push(fallback[Math.floor(Math.random() * fallback.length)]);
  }

  return [correct, ...distractors.slice(0, 3)].sort(() => Math.random() - 0.5);
}

// ============================================================
// 组件
// ============================================================

export default function IntervalPractice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);

  const type = searchParams.get('type') || '随机';
  const direction = searchParams.get('direction') || '随机';
  const clefPref = searchParams.get('clef') || '自动';
  const modePref = searchParams.get('mode') || '随机';
  const usePiano = (localStorage.getItem(NOTES_INPUT_MODE_KEY) ?? 'options') === 'piano';

  const [currentQuestion, setCurrentQuestion] = useState(() =>
    generateInterval(type, direction, clefPref, modePref)
  );
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [noteVisible, setNoteVisible] = useState(true);

  const nextQuestion = useCallback(() => {
    setCurrentQuestion(generateInterval(type, direction, clefPref, modePref));
    setNoteVisible(true);
  }, [type, direction, clefPref, modePref]);

  // Blink effect: show 3s, hide 6s
  useEffect(() => {
    setNoteVisible(true);
    let timeout: ReturnType<typeof setTimeout>;
    const cycle = () => {
      timeout = setTimeout(() => {
        setNoteVisible(false);
        timeout = setTimeout(() => {
          setNoteVisible(true);
          cycle();
        }, 6000);
      }, 3000);
    };
    cycle();
    return () => clearTimeout(timeout);
  }, [currentQuestion]);

  // VexFlow rendering
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const q = currentQuestion;
    const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
    const width = Math.min(500, containerRef.current.clientWidth - 20);
    renderer.resize(width, 200);
    const context = renderer.getContext();

    const stave = new Stave(10, 40, width - 40);
    stave.addClef(q.clef);
    stave.setContext(context).draw();

    try {
      if (q.isHarmonic) {
        // --- 和声音程：叠置全音符 ---
        const lowParsed = parsePitchForVexflow(q.lowPitch);
        const highParsed = parsePitchForVexflow(q.highPitch);
        const note = new StaveNote({
          keys: [lowParsed.key, highParsed.key],
          duration: 'w',
          clef: q.clef,
        });
        if (lowParsed.accidental) note.addModifier(new Accidental(lowParsed.accidental), 0);
        if (highParsed.accidental) note.addModifier(new Accidental(highParsed.accidental), 1);

        const voice = new Voice({ numBeats: 4, beatValue: 4 });
        voice.setMode(2);
        voice.addTickables([note]);
        new Formatter().joinVoices([voice]).format([voice], 200);
        voice.draw(context, stave);
      } else {
        // --- 旋律音程：两音并排 ---
        const lowParsed = parsePitchForVexflow(q.lowPitch);
        const highParsed = parsePitchForVexflow(q.highPitch);

        // Show in ascending pitch order left-to-right for readability
        const vfNotes = [lowParsed, highParsed].map(p => {
          const n = new StaveNote({ keys: [p.key], duration: 'h', clef: q.clef });
          if (p.accidental) n.addModifier(new Accidental(p.accidental));
          return n;
        });

        const voice = new Voice({ numBeats: 4, beatValue: 4 });
        voice.setMode(2);
        voice.addTickables(vfNotes);
        new Formatter().joinVoices([voice]).format([voice], 160);
        voice.draw(context, stave);
      }
    } catch (e) {
      console.error('VexFlow error:', e);
    }
  }, [currentQuestion]);

  const options = useMemo(() => {
    return generateOptions(currentQuestion, type);
  }, [currentQuestion, type]);

  const handleAnswer = (answer: string) => {
    if (feedback !== 'none') return;
    const correct = currentQuestion.intervalName;
    const isCorrect = answer === correct;

    setTotal(t => t + 1);
    if (isCorrect) {
      setScore(s => s + 1);
      setFeedback('correct');
      setTimeout(() => {
        setFeedback('none');
        nextQuestion();
      }, 600);
    } else {
      setFeedback('wrong');
      setTimeout(() => setFeedback('none'), 1500);
    }
  };

  const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;

  const paramLabel = [
    type !== '随机' ? type : null,
    direction !== '随机' ? direction : null,
    clefPref !== '自动' ? clefPref : null,
    modePref !== '随机' ? modePref : null,
  ].filter(Boolean).join(' · ');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', transition: 'background 0.5s ease',
      background: feedback === 'correct' ? '#ecfdf5' : feedback === 'wrong' ? '#fef2f2' : 'transparent'
    }}>
      <header className="quiz-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'white', border: '1px solid #e5e7eb', padding: '8px 16px', borderRadius: '20px', fontSize: '1rem', cursor: 'pointer', color: '#6b7280', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
        >
          退出练习
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {paramLabel && (
            <span style={{ fontSize: '0.85rem', color: '#8b5cf6', fontWeight: '600' }}>
              {paramLabel}
            </span>
          )}
          <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '6px 14px', borderRadius: '12px', fontWeight: '700', fontSize: '0.9rem' }}>
            {score}/{total} ({accuracy}%)
          </span>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div
          className="quiz-card"
          style={{
            background: 'white',
            borderRadius: '32px',
            boxShadow: feedback === 'correct' ? '0 20px 40px rgba(16,185,129,0.15)' : feedback === 'wrong' ? '0 20px 40px rgba(239,68,68,0.15)' : '0 10px 40px rgba(0,0,0,0.04)',
            padding: '40px',
            marginBottom: '60px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '500px',
            minHeight: '180px',
            position: 'relative',
            transform: feedback === 'wrong' ? 'translateX(10px)' : 'none',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            border: '1px solid #f9fafb'
          }}
        >
          <div ref={containerRef} style={{ opacity: noteVisible ? 1 : 0, transition: 'opacity 0.3s ease' }}></div>
        </div>

        {/* Options */}
        {usePiano ? (
          <div style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
            音程练习暂不支持钢琴输入，请使用选项模式
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div className="quiz-options" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '700px' }}>
              {options.map((opt, i) => (
                <button
                  key={`${currentQuestion.semitones}_${i}_${opt}`}
                  onClick={() => handleAnswer(opt)}
                  style={{
                    minWidth: '140px',
                    maxWidth: '260px',
                    padding: '14px 20px',
                    borderRadius: '20px',
                    border: '1px solid #f3f4f6',
                    background: 'white',
                    fontSize: opt.length > 20 ? '0.85rem' : opt.length > 10 ? '1rem' : '1.3rem',
                    fontWeight: '700',
                    color: '#374151',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    lineHeight: '1.4',
                    textAlign: 'center'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 12px 20px rgba(0,0,0,0.06)';
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                  onMouseDown={e => {
                    e.currentTarget.style.transform = 'translateY(2px) scale(0.96)';
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.color = '#8b5cf6';
                  }}
                  onMouseUp={e => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.color = '#374151';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.color = '#374151';
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.03)';
                    e.currentTarget.style.borderColor = '#f3f4f6';
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
