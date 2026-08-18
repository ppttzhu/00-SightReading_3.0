import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Stem } from 'vexflow';
import { useAppStore } from '../../core/store/useAppStore';
import { audioEngine } from '../../core/engine/AudioEngine';
import { generateQuestion, type ProgressionQuestion } from '../../core/progression/questionGenerator';
import { type AnswerChoice } from '../../core/progression/progressions';
import { keySignatureFor } from '../../core/progression/keys';
import { decodeScope } from '../../core/progression/progressionScopeSerializer';
import { buildOptions } from '../../core/progression/progressionOptions';
import { playProgression } from '../../core/engine/progressionAudio';

/** How long the red "wrong" feedback stays before resetting. */
const WRONG_FEEDBACK_RESET_MS = 1200;
/** How long the score is revealed after a correct answer in speaker-only mode. */
const REVEAL_MS = 1000;

/** The patterns (音型) accent green used across this screen. */
const ACCENT = '#10b981';

// ============================================================
// VexFlow rendering helpers (mirrors ChordPractice)
// ============================================================

/**
 * Parse a spelled pitch string (letter + optional single/double accidental +
 * octave) into a VexFlow key, its uppercase letter, and its accidental symbol
 * (`''` natural, `'#'`, `'b'`, `'##'`, `'bb'`). Accepts `##` / `bb` since the
 * chord spelling module can emit double accidentals.
 */
function parsePitchForVexflow(pitchStr: string): { key: string; letter: string; accidental: string } {
  const match = pitchStr.match(/^([A-Ga-g])(##|bb|#|b)?(\d)$/);
  if (!match) return { key: 'c/4', letter: 'C', accidental: '' };
  return {
    key: `${match[1].toLowerCase()}/${match[3]}`,
    letter: match[1].toUpperCase(),
    accidental: match[2] || '',
  };
}

/**
 * Decide which accidental SYMBOL (if any) to draw for a tone under a key
 * signature (`key_signature_rules_for_ai.md`). VexFlow renders the key
 * signature after the clef, so a tone whose accidental already matches the
 * signature draws nothing; a tone that differs draws its own symbol, and a
 * natural tone against a sharped/flatted key draws an explicit natural (`n`).
 *
 * @param letter     the tone's letter (C–B)
 * @param accidental the tone's accidental symbol (`''`, `'#'`, `'b'`, `'##'`, `'bb'`)
 * @param sig        the key signature's per-letter accidental map
 * @returns the VexFlow accidental code to draw, or null to draw nothing
 */
function accidentalToDraw(
  letter: string,
  accidental: string,
  sig: Record<string, string>,
): string | null {
  const sigAcc = sig[letter] ?? '';
  if (accidental === sigAcc) return null; // covered by the key signature
  if (accidental === '') return 'n'; // natural against a sharped/flatted key
  return accidental; // '#', 'b', '##', 'bb'
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

/** Choose the clef by the average MIDI across all tones (bass for low chords). */
function clefForMidis(midis: number[]): 'treble' | 'bass' {
  if (midis.length === 0) return 'treble';
  const avg = midis.reduce((sum, m) => sum + m, 0) / midis.length;
  return avg < 60 ? 'bass' : 'treble';
}

// ============================================================
// 组件
// ============================================================

export default function ProgressionPractice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse the scope from the query string once per URL change.
  const selection = useMemo(() => decodeScope(searchParams), [searchParams]);
  // Whether to show the score. Default off → speaker-only practice; the score
  // is only revealed for REVEAL_MS after a correct answer.
  const showScore = searchParams.get('score') === '1';

  const { recordPractice } = useAppStore();
  const questionStartedRef = useRef(Date.now());

  const [question, setQuestion] = useState<ProgressionQuestion>(() => generateQuestion(selection));
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(audioEngine.enabled);
  const [showAudioTip, setShowAudioTip] = useState(true);
  const [tipFading, setTipFading] = useState(false);
  // Speaker-only mode: briefly reveal the score after a correct answer.
  const [revealing, setRevealing] = useState(false);

  // Guards playback so each question sounds exactly once per presentation.
  const playedRef = useRef<ProgressionQuestion | null>(null);

  useEffect(() => {
    setTipFading(false);
    const t1 = setTimeout(() => setTipFading(true), 3000);
    const t2 = setTimeout(() => setShowAudioTip(false), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [showAudioTip]);

  const nextQuestion = useCallback(() => {
    setQuestion(generateQuestion(selection));
    questionStartedRef.current = Date.now();
  }, [selection]);

  // The four (or fewer) answer options — the selected progressions' Roman
  // numerals in fixed order.
  const options = useMemo(() => buildOptions(selection), [selection]);

  // VexFlow rendering — the three triads side by side on one stave, each a
  // stacked whole note with per-tone accidentals. Only rendered in score mode
  // (or briefly on reveal). Wrapped in try/catch so a render error never breaks
  // play.
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    try {
      const chords = question.chords;
      const allMidis = chords.flatMap((c) => c.midis);
      const clef = clefForMidis(allMidis);
      const sig = keySignatureFor(question.key, question.mode);

      const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
      const width = Math.min(500, containerRef.current.clientWidth - 20);
      renderer.resize(width, 200);
      const context = renderer.getContext();

      const stave = new Stave(10, 40, width - 40);
      stave.addClef(clef);
      // Render the key signature after the clef; note-level accidentals are
      // then only drawn for tones that differ from it (e.g. a minor-V leading
      // tone). See key_signature_rules_for_ai.md.
      stave.addKeySignature(sig.vexKeySpec);
      stave.setContext(context).draw();

      const notes = chords.map((chord) => {
        const parsed = chord.pitches.map(parsePitchForVexflow);
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
          const acc = accidentalToDraw(p.letter, p.accidental, sig.perLetter);
          if (acc) note.addModifier(new Accidental(acc), i);
        });
        return note;
      });

      const voice = new Voice({ numBeats: chords.length * 4, beatValue: 4 });
      voice.setMode(2);
      voice.addTickables(notes);
      new Formatter().joinVoices([voice]).format([voice], width - 80);
      voice.draw(context, stave);
    } catch (e) {
      console.error('VexFlow error:', e);
    }
  }, [question]);

  // Auto-play the progression once per question. Muting clears the guard so
  // toggling mute off→on replays it.
  useEffect(() => {
    if (!audioEnabled) {
      playedRef.current = null;
      return;
    }
    if (playedRef.current === question) return;
    const q = question;
    let cancelled = false;
    (async () => {
      while (!audioEngine.isReady && !cancelled) {
        await new Promise<void>((r) => setTimeout(r, 100));
      }
      if (cancelled) return;
      if (playedRef.current === q) return;
      playedRef.current = q;
      playProgression(q.chords);
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

  // Play the current progression again as three successive blocked chords.
  const playCurrent = () => {
    ensureAudioOn();
    audioEngine.stop();
    playProgression(question.chords);
  };

  const handleAnswer = (choice: AnswerChoice) => {
    if (feedback !== 'none') return;
    const isCorrect = choice === question.correctAnswer;

    const timeSpentMs = Date.now() - questionStartedRef.current;
    recordPractice({
      quizId: `prac_progression_${question.mode}_${question.function}`,
      module: 'patterns',
      isCorrect,
      answeredWrong: isCorrect ? undefined : choice,
      timeSpentMs,
    });

    setTotal((t) => t + 1);
    if (isCorrect) {
      setScore((s) => s + 1);
      setFeedback('correct');
      // Speaker-only mode: reveal the score for REVEAL_MS before advancing.
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
              style={{ background: audioEnabled ? '#ecfdf5' : 'white', border: `1px solid ${audioEnabled ? '#a7f3d0' : '#e5e7eb'}`, borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', transition: 'all 0.2s ease', color: audioEnabled ? ACCENT : '#9ca3af' }}
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
                {audioEnabled ? '音效已开启，出题时会自动播放进行' : '音效已关闭'}
                <div style={{ position: 'absolute', top: '-5px', right: '12px', width: '10px', height: '10px', background: '#1f2937', transform: 'rotate(45deg)' }} />
              </div>
            )}
          </div>
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
            marginBottom: '48px',
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
          {/* Notation — shown in score mode, or briefly revealed after a correct
              answer in speaker-only mode. */}
          <div ref={containerRef} data-testid="progression-notation" style={{ opacity: (showScore || revealing) ? 1 : 0, transition: 'opacity 0.3s ease' }}></div>

          {/* Speaker-only mode: a single speaker to (re)play the progression. */}
          {!showScore && !revealing && (
            <div data-testid="progression-speaker" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={playCurrent}
                  title="播放和声进行"
                  aria-label="播放和声进行"
                  style={{ background: `${ACCENT}12`, border: `2px solid ${ACCENT}`, borderRadius: '50%', width: '72px', height: '72px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT, transition: 'all 0.15s' }}
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
                <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#6b7280' }}>播放</span>
              </div>
            </div>
          )}

          {/* In score mode, a replay control below the notation. */}
          {showScore && (
            <button
              type="button"
              onClick={playCurrent}
              title="播放和声进行"
              aria-label="播放和声进行"
              style={{ marginTop: '16px', background: `${ACCENT}12`, border: `2px solid ${ACCENT}`, borderRadius: '24px', padding: '10px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: ACCENT, fontWeight: '700', fontSize: '0.95rem', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <polygon points="6 4 20 12 6 20 6 4"/>
              </svg>
              重播
            </button>
          )}
        </div>

        {/* Options — the selected progressions' Roman numerals in fixed order. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div className="quiz-options" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '700px' }}>
            {options.map((choice) => (
              <button
                key={choice}
                onClick={() => handleAnswer(choice)}
                style={{
                  minWidth: '140px',
                  maxWidth: '260px',
                  padding: '14px 20px',
                  borderRadius: '20px',
                  border: '1px solid #f3f4f6',
                  background: 'white',
                  fontSize: '1.15rem',
                  fontWeight: '700',
                  color: '#374151',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
                  whiteSpace: 'nowrap',
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
                  e.currentTarget.style.color = ACCENT;
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
                {choice}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
