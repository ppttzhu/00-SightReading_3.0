import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Stem } from 'vexflow';
import { useAppStore } from '../../core/store/useAppStore';
import { useBlinkTimer } from '../../hooks/useBlinkTimer';
import { audioEngine } from '../../core/engine/AudioEngine';
import { playIntervalPairAudio, playIntervalHarmonic, WRONG_FEEDBACK_RESET_MS } from '../../core/engine/intervalAudio';
import { decodeScope } from '../../core/theory/scopeSerializer';
import {
  generateQuestion,
  type GenerateResult,
  type IntervalQuestion,
} from '../../core/theory/intervalGenerator';
import {
  CATALOG_BY_ID,
  displayName,
  QUALITY_LABELS,
  NUMBER_LABELS,
  type IntervalNumber,
  type IntervalQuality,
} from '../../core/theory/intervalCatalog';

/** Quality answer options, in fixed display order (减 小 纯 大 增). */
const QUALITY_ORDER: IntervalQuality[] = ['diminished', 'minor', 'perfect', 'major', 'augmented'];
/** Number answer options, in fixed display order (1–8). */
const NUMBER_ORDER: IntervalNumber[] = [1, 2, 3, 4, 5, 6, 7, 8];

// ============================================================
// VexFlow rendering helpers
// ============================================================

/**
 * Parse a spelled pitch string (letter + optional single/double accidental +
 * octave) into a VexFlow key and accidental. Accepts `##` / `bb` since the
 * theory spelling module can emit double accidentals.
 */
function parsePitchForVexflow(pitchStr: string): { key: string; accidental: string | null } {
  const match = pitchStr.match(/^([A-Ga-g])(##|bb|#|b)?(\d)$/);
  if (!match) return { key: 'c/4', accidental: null };
  return {
    key: `${match[1].toLowerCase()}/${match[3]}`,
    accidental: match[2] || null,
  };
}

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

// ============================================================
// Empty / unplaceable messages
// ============================================================

type EmptyReason = Extract<GenerateResult, { ok: false }>['reason'];

const EMPTY_MESSAGES: Record<EmptyReason, string> = {
  'empty-selection': '当前没有可练习的音程，请返回重新选择音程范围。',
  'no-placeable-interval': '所选音程无法在谱面上生成，请返回调整选择。',
};

/** How long the score is revealed after a correct answer in speakers-only mode. */
const REVEAL_MS = 1000;

// ============================================================
// 组件
// ============================================================

export default function IntervalPractice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse the scope from the query string once per URL change.
  const subset = useMemo(() => decodeScope(searchParams), [searchParams]);
  // Whether to show the score. Default off → speakers-only practice; the score
  // is only revealed for REVEAL_MS after a correct answer.
  const showScore = searchParams.get('score') === '1';

  const { recordPractice } = useAppStore();
  const questionStartedRef = useRef(Date.now());

  const [result, setResult] = useState<GenerateResult>(() => generateQuestion(subset));
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(audioEngine.enabled);
  const [showAudioTip, setShowAudioTip] = useState(true);
  const [tipFading, setTipFading] = useState(false);
  // Speakers-only mode: briefly reveal the score after a correct answer.
  const [revealing, setRevealing] = useState(false);
  // Two-click answer: the learner picks one quality and one number.
  const [selectedQuality, setSelectedQuality] = useState<IntervalQuality | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<IntervalNumber | null>(null);

  const question: IntervalQuestion | null = result.ok ? result.question : null;

  // Answer options are fixed and derived from the practice scope: only the
  // qualities / numbers that actually occur among the selected intervals.
  const { qualityOptions, numberOptions } = useMemo(() => {
    const entries = [...subset]
      .map((id) => CATALOG_BY_ID.get(id))
      .filter((e): e is NonNullable<typeof e> => e !== undefined);
    return {
      qualityOptions: QUALITY_ORDER.filter((q) => entries.some((e) => e.quality === q)),
      numberOptions: NUMBER_ORDER.filter((n) => entries.some((e) => e.number === n)),
    };
  }, [subset]);

  useEffect(() => {
    setTipFading(false);
    const t1 = setTimeout(() => setTipFading(true), 3000);
    const t2 = setTimeout(() => setShowAudioTip(false), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [showAudioTip]);

  const nextQuestion = useCallback(() => {
    setResult(generateQuestion(subset));
    setSelectedQuality(null);
    setSelectedNumber(null);
    questionStartedRef.current = Date.now();
  }, [subset]);

  const { noteVisible, resetBlink } = useBlinkTimer(3000, 6000, result);

  // VexFlow rendering
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';
    if (!question) return;

    const q = question;
    const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
    const width = Math.min(500, containerRef.current.clientWidth - 20);
    renderer.resize(width, 200);
    const context = renderer.getContext();

    const stave = new Stave(10, 40, width - 40);
    stave.addClef(q.clef);
    stave.setContext(context).draw();

    try {
      if (q.isHarmonic) {
        // --- 和声音程 ---
        const lowParsed = parsePitchForVexflow(q.lowPitch);
        const highParsed = parsePitchForVexflow(q.highPitch);

        if (q.lowPitch === q.highPitch) {
          // 同音：和不同音一样，渲染单个全音符
          const stemDir = resolveStemDirection(lowParsed.key, highParsed.key, q.clef);
          const note = new StaveNote({
            keys: [lowParsed.key],
            duration: 'w',
            clef: q.clef,
            stemDirection: stemDir,
          });
          if (lowParsed.accidental) note.addModifier(new Accidental(lowParsed.accidental));
          const voice = new Voice({ numBeats: 4, beatValue: 4 });
          voice.setMode(2);
          voice.addTickables([note]);
          new Formatter().joinVoices([voice]).format([voice], 200);
          voice.draw(context, stave);
        } else {
          const stemDir = resolveStemDirection(lowParsed.key, highParsed.key, q.clef);
          const note = new StaveNote({
            keys: [lowParsed.key, highParsed.key],
            duration: 'w',
            clef: q.clef,
            stemDirection: stemDir,
          });
          if (lowParsed.accidental) note.addModifier(new Accidental(lowParsed.accidental), 0);
          if (highParsed.accidental) note.addModifier(new Accidental(highParsed.accidental), 1);

          const voice = new Voice({ numBeats: 4, beatValue: 4 });
          voice.setMode(2);
          voice.addTickables([note]);
          new Formatter().joinVoices([voice]).format([voice], 200);
          voice.draw(context, stave);
        }
      } else {
        // --- 旋律音程：两音并排（按方向排序：上行低→高，下行高→低）---
        const firstPitch = q.dir === 1 ? q.lowPitch : q.highPitch;
        const secondPitch = q.dir === 1 ? q.highPitch : q.lowPitch;
        const firstParsed = parsePitchForVexflow(firstPitch);
        const secondParsed = parsePitchForVexflow(secondPitch);
        const lowParsed = parsePitchForVexflow(q.lowPitch);
        const highParsed = parsePitchForVexflow(q.highPitch);
        const stemDir = resolveStemDirection(lowParsed.key, highParsed.key, q.clef);

        const vfNotes = [firstParsed, secondParsed].map(p => {
          const n = new StaveNote({ keys: [p.key], duration: 'h', clef: q.clef, stemDirection: stemDir });
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
  }, [question]);

  // 题目出现时自动播放音程（和声=同时，旋律=先后：上行低→高，下行高→低）。
  // 依赖 audioEnabled，所以「静音再取消静音」会重新播放一遍当前题目。
  useEffect(() => {
    if (!audioEnabled || !question) return;
    const q = question;
    let cancelled = false;
    (async () => {
      while (!audioEngine.isReady && !cancelled) {
        await new Promise<void>(r => setTimeout(r, 100));
      }
      if (cancelled) return;
      if (q.isHarmonic) {
        playIntervalHarmonic(q.lowPitch, q.highPitch);
      } else {
        const first = q.dir === 1 ? q.lowPitch : q.highPitch;
        const second = q.dir === 1 ? q.highPitch : q.lowPitch;
        playIntervalPairAudio(first, second);
      }
    })();
    return () => { cancelled = true; };
  }, [question, audioEnabled]);

  // Ensure audio is on for an explicit play request (speaker click).
  const ensureAudioOn = () => {
    if (!audioEngine.enabled) {
      audioEngine.setEnabled(true);
      setAudioEnabled(true);
    }
    void audioEngine.prime();
  };

  // Left speaker: play the interval harmonically (both notes at once).
  const playHarmonic = () => {
    if (!question) return;
    ensureAudioOn();
    audioEngine.stop();
    playIntervalHarmonic(question.lowPitch, question.highPitch);
  };

  // Right speaker: play the interval melodically (先后：上行低→高，下行高→低).
  const playMelodic = () => {
    if (!question) return;
    ensureAudioOn();
    audioEngine.stop();
    const first = question.dir === 1 ? question.lowPitch : question.highPitch;
    const second = question.dir === 1 ? question.highPitch : question.lowPitch;
    playIntervalPairAudio(first, second);
  };

  // Evaluate once both a quality and a number have been picked.
  const evaluateAnswer = (q: IntervalQuality, n: IntervalNumber) => {
    if (!question) return;
    resetBlink();
    const isCorrect =
      question.interval.quality === q && question.interval.number === n;

    const timeSpentMs = Date.now() - questionStartedRef.current;
    recordPractice({
      quizId: `prac_theory_${displayName(question.correctAnswer)}`,
      module: 'theory',
      isCorrect,
      answeredWrong: isCorrect ? undefined : `${QUALITY_LABELS[q]}${NUMBER_LABELS[n]}`,
      timeSpentMs,
    });

    setTotal(t => t + 1);
    if (isCorrect) {
      setScore(s => s + 1);
      setFeedback('correct');
      // Speakers-only mode: reveal the score for REVEAL_MS before advancing.
      if (!showScore) setRevealing(true);
      const delay = showScore ? 600 : REVEAL_MS;
      setTimeout(() => {
        audioEngine.stop();
        setFeedback('none');
        if (!showScore) setRevealing(false);
        nextQuestion();
      }, delay);
    } else {
      setFeedback('wrong');
      setTimeout(() => {
        setFeedback('none');
        setSelectedQuality(null);
        setSelectedNumber(null);
      }, WRONG_FEEDBACK_RESET_MS);
    }
  };

  // Pick a quality; if a number is already picked, evaluate the pair.
  const chooseQuality = (q: IntervalQuality) => {
    if (feedback !== 'none') return;
    setSelectedQuality(q);
    if (selectedNumber !== null) evaluateAnswer(q, selectedNumber);
  };

  // Pick a number; if a quality is already picked, evaluate the pair.
  const chooseNumber = (n: IntervalNumber) => {
    if (feedback !== 'none') return;
    setSelectedNumber(n);
    if (selectedQuality !== null) evaluateAnswer(selectedQuality, n);
  };

  const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;

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
          <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '6px 14px', borderRadius: '12px', fontWeight: '700', fontSize: '0.9rem' }}>
            {score}/{total} ({accuracy}%)
          </span>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { audioEngine.setEnabled(!audioEngine.enabled); if (audioEngine.enabled) void audioEngine.prime(); setAudioEnabled(audioEngine.enabled); setShowAudioTip(true); }}
              title={audioEnabled ? '关闭音效' : '开启音效'}
              style={{ background: audioEnabled ? '#eff6ff' : 'white', border: `1px solid ${audioEnabled ? '#bfdbfe' : '#e5e7eb'}`, borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', transition: 'all 0.2s ease', color: audioEnabled ? '#3b82f6' : '#9ca3af' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
              onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.93)'; }}
              onMouseUp={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
            >
              {audioEnabled ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <line x1="23" y1="9" x2="17" y2="15"/>
                  <line x1="17" y1="9" x2="23" y2="15"/>
                </svg>
              )}
            </button>
            {showAudioTip && (
              <div style={{ position: 'absolute', right: 0, top: '44px', background: '#1f2937', color: 'white', borderRadius: '10px', padding: '8px 12px', fontSize: '0.8rem', whiteSpace: 'nowrap', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', opacity: tipFading ? 0 : 1, transition: 'opacity 0.5s ease' }}>
                {audioEnabled ? '音效已开启，静音后再开启可重播' : '音效已关闭'}
                <div style={{ position: 'absolute', top: '-5px', right: '12px', width: '10px', height: '10px', background: '#1f2937', transform: 'rotate(45deg)' }} />
              </div>
            )}
          </div>
        </div>
      </header>

      {!result.ok ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
          <div
            style={{
              background: 'white',
              borderRadius: '32px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.04)',
              padding: '48px',
              maxWidth: '520px',
              textAlign: 'center',
              color: '#6b7280',
              fontSize: '1.05rem',
              fontWeight: '600',
              lineHeight: '1.6',
              border: '1px solid #f9fafb',
            }}
          >
            {EMPTY_MESSAGES[result.reason]}
          </div>
          <button
            onClick={() => navigate(-1)}
            style={{ background: '#8b5cf6', border: 'none', padding: '12px 28px', borderRadius: '20px', fontSize: '1rem', cursor: 'pointer', color: 'white', fontWeight: '700', boxShadow: '0 4px 15px rgba(139,92,246,0.25)' }}
          >
            返回选择
          </button>
        </div>
      ) : (
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
            <div ref={containerRef} data-testid="interval-notation" style={{ opacity: (showScore ? noteVisible : revealing) ? 1 : 0, transition: 'opacity 0.3s ease' }}></div>

            {/* Speakers-only mode: two speakers to hear the interval (harmonic / melodic) */}
            {!showScore && !revealing && (
              <div data-testid="interval-speakers" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '56px' }}>
                {([
                  { key: 'harmonic', label: '柱式', title: '播放和声音程（同时）', onClick: playHarmonic, color: '#8b5cf6' },
                  { key: 'melodic', label: '分解', title: '播放旋律音程（先后）', onClick: playMelodic, color: '#10b981' },
                ] as const).map(({ key, label, title, onClick, color }) => (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={onClick}
                      title={title}
                      aria-label={title}
                      style={{ background: `${color}12`, border: `2px solid ${color}`, borderRadius: '50%', width: '72px', height: '72px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color, transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                      onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.94)'; }}
                      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                    >
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                      </svg>
                    </button>
                    <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#6b7280' }}>{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Two-click answer: pick a quality (row 1) and a number (row 2) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {qualityOptions.map((q) => {
                const active = selectedQuality === q;
                return (
                  <button
                    key={q}
                    type="button"
                    onClick={() => chooseQuality(q)}
                    style={{
                      minWidth: '56px', padding: '12px 18px', borderRadius: '16px', cursor: 'pointer',
                      fontSize: '1.05rem', fontWeight: '700', transition: 'all 0.15s',
                      border: active ? '2px solid #8b5cf6' : '2px solid #e5e7eb',
                      background: active ? '#8b5cf612' : 'white',
                      color: active ? '#8b5cf6' : '#374151',
                    }}
                  >
                    {QUALITY_LABELS[q]}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {numberOptions.map((n) => {
                const active = selectedNumber === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => chooseNumber(n)}
                    style={{
                      minWidth: '48px', padding: '12px 16px', borderRadius: '16px', cursor: 'pointer',
                      fontSize: '1.05rem', fontWeight: '700', fontFamily: 'monospace', transition: 'all 0.15s',
                      border: active ? '2px solid #8b5cf6' : '2px solid #e5e7eb',
                      background: active ? '#8b5cf612' : 'white',
                      color: active ? '#8b5cf6' : '#374151',
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
