import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Stem } from 'vexflow';
import { useAppStore } from '../../core/store/useAppStore';
import { useBlinkTimer } from '../../hooks/useBlinkTimer';
import { useOptionsFontSize } from '../../hooks/useOptionsFontSize';
import { audioEngine } from '../../core/engine/AudioEngine';
import { decodeScope } from '../../core/chords/chordScopeSerializer';
import {
  generateQuestion,
  type GenerateResult,
  type ChordQuestion,
} from '../../core/chords/chordGenerator';
import { buildOptions } from '../../core/chords/chordOptions';
import { displayLabel } from '../../core/chords/chordCatalog';
import { playSequentialNotes } from '../../core/engine/intervalAudio';

/** How long the red "wrong" feedback stays before resetting. */
const WRONG_FEEDBACK_RESET_MS = 1200;
/** How long the score is revealed after a correct answer in speakers-only mode. */
const REVEAL_MS = 1000;

// ============================================================
// VexFlow rendering helpers
// ============================================================

/**
 * Parse a spelled pitch string (letter + optional single/double accidental +
 * octave) into a VexFlow key and accidental. Accepts `##` / `bb` since the
 * chord spelling module can emit double accidentals (e.g. a Dim7 `Bbb`).
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

function resolveStemDirection(lowKey: string, highKey: string, clef: string): number {
  const middleNote = clef === 'bass' ? 'd' : 'b';
  const middleOctave = clef === 'bass' ? 3 : 4;
  const middleStep = NOTE_STEP[middleNote] + middleOctave * 7;
  const lowStep = getDiatonicStep(lowKey);
  const highStep = getDiatonicStep(highKey);
  if (lowStep > middleStep) return Stem.DOWN;
  if (highStep < middleStep) return Stem.UP;
  return Stem.DOWN;
}

/** Choose the clef by the chord's average MIDI (bass for low chords). */
function clefForMidis(midis: number[]): 'treble' | 'bass' {
  if (midis.length === 0) return 'treble';
  const avg = midis.reduce((sum, m) => sum + m, 0) / midis.length;
  return avg < 60 ? 'bass' : 'treble';
}

// ============================================================
// Empty / unplaceable messages
// ============================================================

type EmptyReason = Extract<GenerateResult, { ok: false }>['reason'];

const EMPTY_MESSAGES: Record<EmptyReason, string> = {
  'empty-selection': '当前没有可练习的和弦，请返回重新选择和弦类型。',
  'no-placeable-chord': '所选和弦无法在谱面上生成，请返回调整选择。',
};

// ============================================================
// 组件
// ============================================================

export default function ChordPractice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse the scope from the query string once per URL change.
  const selection = useMemo(() => decodeScope(searchParams), [searchParams]);
  // Whether to show the score. Default off → speakers-only practice; the score
  // is only revealed for REVEAL_MS after a correct answer.
  const showScore = searchParams.get('score') === '1';

  const { recordPractice } = useAppStore();
  const questionStartedRef = useRef(Date.now());

  const [result, setResult] = useState<GenerateResult>(() => generateQuestion(selection));
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(audioEngine.enabled);
  const [showAudioTip, setShowAudioTip] = useState(true);
  const [tipFading, setTipFading] = useState(false);
  // Speakers-only mode: briefly reveal the score after a correct answer.
  const [revealing, setRevealing] = useState(false);

  const question: ChordQuestion | null = result.ok ? result.question : null;

  // Guards playback so each question sounds exactly once per presentation.
  const playedRef = useRef<ChordQuestion | null>(null);

  useEffect(() => {
    setTipFading(false);
    const t1 = setTimeout(() => setTipFading(true), 3000);
    const t2 = setTimeout(() => setShowAudioTip(false), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [showAudioTip]);

  const nextQuestion = useCallback(() => {
    setResult(generateQuestion(selection));
    questionStartedRef.current = Date.now();
  }, [selection]);

  const { noteVisible, resetBlink } = useBlinkTimer(3000, 6000, result);

  // VexFlow rendering — a single stacked whole note with per-tone accidentals.
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';
    if (!question) return;

    const q = question;
    try {
      const clef = clefForMidis(q.midis);
      const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
      const width = Math.min(500, containerRef.current.clientWidth - 20);
      renderer.resize(width, 200);
      const context = renderer.getContext();

      const stave = new Stave(10, 40, width - 40);
      stave.addClef(clef);
      stave.setContext(context).draw();

      const parsed = q.pitches.map(parsePitchForVexflow);
      const lowKey = parsed[0].key;
      const highKey = parsed[parsed.length - 1].key;
      const stemDir = resolveStemDirection(lowKey, highKey, clef);

      const note = new StaveNote({
        keys: parsed.map((p) => p.key),
        duration: 'w',
        clef,
        stemDirection: stemDir,
      });
      parsed.forEach((p, i) => {
        if (p.accidental) note.addModifier(new Accidental(p.accidental), i);
      });

      const voice = new Voice({ numBeats: 4, beatValue: 4 });
      voice.setMode(2);
      voice.addTickables([note]);
      new Formatter().joinVoices([voice]).format([voice], 200);
      voice.draw(context, stave);
    } catch (e) {
      console.error('VexFlow error:', e);
    }
  }, [question]);

  // Auto-play the blocked (harmonic) chord once when a new question appears — in
  // both modes. Muting clears the guard so toggling mute off→on replays it; the
  // two speakers (speakers-only mode) let the learner replay blocked/arpeggiated.
  useEffect(() => {
    if (!audioEnabled) {
      playedRef.current = null;
      return;
    }
    if (!question) return;
    if (playedRef.current === question) return;
    const q = question;
    let cancelled = false;
    (async () => {
      while (!audioEngine.isReady && !cancelled) {
        await new Promise<void>(r => setTimeout(r, 100));
      }
      if (cancelled) return;
      if (playedRef.current === q) return;
      playedRef.current = q;
      audioEngine.playNotes(q.pitches);
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

  // Left speaker: play the chord as a blocked/harmonic chord (all tones at once).
  const playHarmonic = () => {
    if (!question) return;
    ensureAudioOn();
    audioEngine.stop();
    audioEngine.playNotes(question.pitches);
  };

  // Right speaker: play the chord arpeggiated/melodic (tones in sequence).
  const playMelodic = () => {
    if (!question) return;
    ensureAudioOn();
    audioEngine.stop();
    playSequentialNotes(question.pitches);
  };

  const options = useMemo(() => {
    return question ? buildOptions(question.chordType, selection) : [];
  }, [question, selection]);

  // Use a uniform font size based on the longest option text.
  const optionsFontSize = useOptionsFontSize(options);

  const handleAnswer = (answer: string) => {
    if (feedback !== 'none' || !question) return;
    resetBlink();
    const correct = displayLabel(question.correctAnswer);
    const isCorrect = answer === correct;

    const timeSpentMs = Date.now() - questionStartedRef.current;
    recordPractice({
      quizId: `prac_chord_${question.chordType.id}`,
      module: 'patterns',
      isCorrect,
      answeredWrong: isCorrect ? undefined : answer,
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
      setTimeout(() => setFeedback('none'), WRONG_FEEDBACK_RESET_MS);
    }
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
                {audioEnabled ? '音效已开启，出题时会同时播放和弦各音' : '音效已关闭'}
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
            <div ref={containerRef} data-testid="chord-notation" style={{ opacity: (showScore ? noteVisible : revealing) ? 1 : 0, transition: 'opacity 0.3s ease' }}></div>

            {/* Speakers-only mode: two speakers to hear the chord (blocked / arpeggiated) */}
            {!showScore && !revealing && (
              <div data-testid="chord-speakers" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '56px' }}>
                {([
                  { key: 'harmonic', label: '柱式', title: '播放柱式和弦（同时）', onClick: playHarmonic, color: '#8b5cf6' },
                  { key: 'melodic', label: '分解', title: '播放分解和弦（先后）', onClick: playMelodic, color: '#10b981' },
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

          {/* Options */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div className="quiz-options" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '700px' }}>
              {options.map((opt, i) => (
                <button
                  key={`${question!.chordType.id}_${i}_${opt}`}
                  onClick={() => {
                    handleAnswer(opt);
                  }}
                  style={{
                    minWidth: '140px',
                    maxWidth: '260px',
                    padding: '14px 20px',
                    borderRadius: '20px',
                    border: '1px solid #f3f4f6',
                    background: 'white',
                    fontSize: optionsFontSize,
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
                    if (audioEnabled) void audioEngine.prime();
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
        </div>
      )}
    </div>
  );
}
