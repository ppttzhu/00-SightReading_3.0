import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, StaveConnector } from 'vexflow';
import FullPianoKeyboard from '../../components/FullPianoKeyboard';
import NotesInputModeToggle from '../../components/NotesInputModeToggle';
import { useNotesInputMode } from '../../hooks/useNotesInputMode';
import { audioEngine } from '../../core/engine/AudioEngine';
import { getClefForPitches, getGrandStaffPlacement, pitchEqual, pitchForAnswerLetter, pitchToStaffNum } from '../../core/engine/pitchUtils';
import type { ClefType } from '../../core/engine/pitchUtils';
import { answerLetterToSolfege } from '../../core/engine/solfegeUtils';
import { WRONG_FEEDBACK_RESET_MS } from '../../core/engine/intervalAudio';
import { mapKeyToNote, isSharpKey, isFlatKey, parseNoteKeys } from './keyboardInput';
import { extractNoteAnswer } from './noteAnswer';
import { practiceOptions } from './noteOptions';
import { useAppStore } from '../../core/store/useAppStore';
import { useBlinkTimer } from '../../hooks/useBlinkTimer';

// Skip the rare enharmonic spellings (E#/B#/Cb/Fb) when generating accidentals.
const SHARP_OK = new Set(['C', 'D', 'F', 'G', 'A']);
const FLAT_OK = new Set(['D', 'E', 'G', 'A', 'B']);

/** 大谱表 / 单谱表共用同一画布高度（须能完整显示高低音两行谱表） */
const STAFF_CANVAS_HEIGHT = 185;

function parsePitchForVexflow(pitchStr: string): { key: string; accidental: string | null } {
  const match = pitchStr.match(/^([A-Ga-g])(#|b)?(\d)$/);
  if (!match) return { key: 'c/4', accidental: null };
  return {
    key: `${match[1].toLowerCase()}/${match[3]}`,
    accidental: match[2] || null
  };
}

// Generate a random pitch between low and high (inclusive), avoiding prev.
// When includeSharps and/or includeFlats are true, ~40% of pitches get the
// respective accidental.
function randomPitch(
  low: string,
  high: string,
  prev: string | undefined,
  includeSharps: boolean,
  includeFlats: boolean,
): string {
  const lowNum = pitchToStaffNum(low);
  const highNum = pitchToStaffNum(high);
  if (highNum <= lowNum) return low;

  const noteNames = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  let pitch = '';
  let attempts = 0;
  do {
    const target = lowNum + Math.floor(Math.random() * (highNum - lowNum + 1));
    const octave = Math.floor(target / 7);
    const letter = noteNames[target % 7];
    let acc = '';
    if (includeSharps || includeFlats) {
      const canSharp = includeSharps && SHARP_OK.has(letter);
      const canFlat = includeFlats && FLAT_OK.has(letter);
      if (Math.random() < 0.4) {
        if (canSharp && canFlat) acc = Math.random() < 0.5 ? '#' : 'b';
        else if (canSharp) acc = '#';
        else if (canFlat) acc = 'b';
      }
    }
    pitch = `${letter}${acc}${octave}`;
    attempts++;
  } while (pitch === prev && attempts < 20);
  return pitch;
}

export default function PracticeQuiz() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);

  const low = searchParams.get('low') || 'C2';
  const high = searchParams.get('high') || 'C6';
  const includeSharps = searchParams.get('sharp') === '1';
  const includeFlats = searchParams.get('flat') === '1';

  const [usePiano, setUsePiano] = useNotesInputMode();
  const { recordPractice } = useAppStore();
  const questionStartedRef = useRef(Date.now());

  const [currentPitch, setCurrentPitch] = useState(() => randomPitch(low, high, undefined, includeSharps, includeFlats));
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(audioEngine.enabled);
  const [showAudioTip, setShowAudioTip] = useState(true);
  const [tipFading, setTipFading] = useState(false);
  const [solfege, setSolfege] = useState<{ label: string; fading: boolean; note: string; tone: 'correct' | 'wrong' } | null>(null);
  const solfegeToneRef = useRef<'correct' | 'wrong' | null>(null);
  const previewOpts = { preview: true } as const;
  useEffect(() => {
    setTipFading(false);
    const t1 = setTimeout(() => setTipFading(true), 3000);
    const t2 = setTimeout(() => setShowAudioTip(false), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [showAudioTip]);

  useEffect(() => {
    return audioEngine.subscribe((evt) => {
      if (evt.type === 'start') {
        const tone = solfegeToneRef.current ?? 'wrong';
        solfegeToneRef.current = null;
        setSolfege({
          label: answerLetterToSolfege(extractNoteAnswer(evt.note)),
          fading: false,
          note: evt.note,
          tone,
        });
      }
      if (evt.type === 'fade') {
        setSolfege((s) => (s?.note === evt.note ? { ...s, fading: true } : s));
      }
      if (evt.type === 'end') {
        setSolfege((s) => (s?.note === evt.note ? null : s));
      }
    });
  }, []);

  const clef = useMemo<ClefType>(() => getClefForPitches(currentPitch, { allowGrand: true }), [currentPitch]);

  const nextQuestion = useCallback(() => {
    setCurrentPitch(randomPitch(low, high, currentPitch, includeSharps, includeFlats));
    questionStartedRef.current = Date.now();
  }, [low, high, currentPitch, includeSharps, includeFlats]);

  const { noteVisible, resetBlink } = useBlinkTimer(3000, 6000, currentPitch);

  // Render VexFlow
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
    const width = Math.min(500, Math.max(280, containerRef.current.clientWidth - 8));
    renderer.resize(width, STAFF_CANVAS_HEIGHT);
    const context = renderer.getContext();
    const staveW = width - 40;

    if (clef === 'grand') {
      const staveTop = new Stave(10, 6, staveW);
      staveTop.addClef('treble');
      staveTop.setContext(context).draw();

      const staveBottom = new Stave(10, 78, staveW);
      staveBottom.addClef('bass');
      staveBottom.setContext(context).draw();

      const connector = new StaveConnector(staveTop, staveBottom);
      connector.setType(StaveConnector.type.BRACE);
      connector.setContext(context).draw();

      const placement = getGrandStaffPlacement(currentPitch);
      const activeStave = placement === 'treble' ? staveTop : staveBottom;

      try {
        const { key, accidental } = parsePitchForVexflow(currentPitch);
        const note = new StaveNote({ keys: [key], duration: 'w', clef: placement });
        if (accidental) note.addModifier(new Accidental(accidental));

        const voice = new Voice({ numBeats: 4, beatValue: 4 });
        voice.setMode(2);
        voice.addTickables([note]);
        new Formatter().joinVoices([voice]).format([voice], 350);
        voice.draw(context, activeStave);
      } catch (e) {
        console.error('VexFlow error:', e);
      }
      return;
    }

    // ── 单五线谱：在同一画布内垂直居中 ──
    const stave = new Stave(10, 38, staveW);
    stave.addClef(clef);
    stave.setContext(context).draw();

    try {
      const { key, accidental } = parsePitchForVexflow(currentPitch);
      const note = new StaveNote({ keys: [key], duration: 'w', clef });
      if (accidental) note.addModifier(new Accidental(accidental));

      const voice = new Voice({ numBeats: 4, beatValue: 4 });
      voice.setMode(2);
      voice.addTickables([note]);
      new Formatter().joinVoices([voice]).format([voice], 350);
      voice.draw(context, stave);
    } catch (e) {
      console.error('VexFlow error:', e);
    }
  }, [currentPitch, clef]);

  const handleAnswer = (answer: string) => {
    if (feedback !== 'none') return;
    resetBlink();
    // Piano mode submits the full pitch (e.g. "C#4") — pitchEqual checks
    // letter, accidental, and octave together. Options mode submits the
    // letter+accidental (e.g. "C#") so a C#4 question needs "C#", not bare "C".
    const isCorrect = usePiano
      ? pitchEqual(answer, currentPitch)
      : answer === extractNoteAnswer(currentPitch);

    solfegeToneRef.current = isCorrect ? 'correct' : 'wrong';
    setSolfege((s) => (s ? { ...s, tone: solfegeToneRef.current! } : s));

    const timeSpentMs = Date.now() - questionStartedRef.current;
    recordPractice({
      quizId: `prac_notes_${currentPitch}`,
      module: 'notes',
      isCorrect,
      answeredWrong: isCorrect ? undefined : answer,
      timeSpentMs,
    });

    setTotal(t => t + 1);
    if (isCorrect) {
      setScore(s => s + 1);
      setFeedback('correct');
      setTimeout(() => {
        audioEngine.stop({ lifecycle: true });
        setFeedback('none');
        nextQuestion();
      }, 600);
    } else {
      setFeedback('wrong');
      setTimeout(() => setFeedback('none'), WRONG_FEEDBACK_RESET_MS);
    }
  };
  const handleAnswerRef = useRef<(a: string) => void>(() => {});
  handleAnswerRef.current = handleAnswer;

  // Options match the question's accidental class: sharp pitch → 7 sharps,
  // flat → 7 flats, natural → 7 naturals. Always 7, in fixed C…B order.
  const options = useMemo(
    () => practiceOptions(extractNoteAnswer(currentPitch)),
    [currentPitch],
  );

  // Physical keyboard input for options mode. 300ms buffer lets "C" + "#"
  // resolve to a single "C#" answer.
  useEffect(() => {
    if (usePiano) return;
    const WINDOW_MS = 300;
    let buffer: string[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      const ans = parseNoteKeys(buffer);
      buffer = [];
      if (!ans) return;
      void audioEngine.playNote(pitchForAnswerLetter(ans, currentPitch), previewOpts);
      handleAnswerRef.current(ans);
    };
    const onKeydown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const isLetter = mapKeyToNote(e.key) !== null;
      const isAccidental = isSharpKey(e.key) || isFlatKey(e.key);
      if (!isLetter && !isAccidental) return;
      e.preventDefault();
      buffer.push(e.key);
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, WINDOW_MS);
    };
    window.addEventListener('keydown', onKeydown);
    return () => {
      window.removeEventListener('keydown', onKeydown);
      if (timer) clearTimeout(timer);
    };
  }, [usePiano, currentPitch]);

  const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;

  return (
    <div
      className="practice-notes-quiz"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        transition: 'background 0.5s ease',
        background: feedback === 'correct' ? '#ecfdf5' : feedback === 'wrong' ? '#fef2f2' : 'transparent',
      }}
    >
      <header className="quiz-header practice-notes-quiz__header">
        <button
          type="button"
          className="practice-notes-quiz__exit"
          onClick={() => navigate(-1)}
        >
          退出练习
        </button>
        <div className="practice-notes-quiz__toolbar">
          <NotesInputModeToggle usePiano={usePiano} onChange={setUsePiano} />
          <div className="practice-notes-quiz__toolbar-end">
            <span className="practice-notes-quiz__range">
              音域: {low} — {high}
            </span>
            <span className="practice-notes-quiz__score">
              {score}/{total} ({accuracy}%)
            </span>
            <div className="practice-notes-quiz__audio">
            <button
              type="button"
              className="practice-notes-quiz__audio-btn"
              onClick={() => { audioEngine.setEnabled(!audioEngine.enabled); if (audioEngine.enabled) void audioEngine.prime(); setAudioEnabled(audioEngine.enabled); setShowAudioTip(true); }}
              title={audioEnabled ? '关闭音效' : '开启音效'}
              style={{ background: audioEnabled ? '#eff6ff' : 'white', border: `1px solid ${audioEnabled ? '#bfdbfe' : '#e5e7eb'}`, color: audioEnabled ? '#3b82f6' : '#9ca3af' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
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
              <div className="practice-notes-quiz__audio-tip" style={{ opacity: tipFading ? 0 : 1 }}>
                {audioEnabled ? '音效已开启，答题时会播放音符声音' : '音效已关闭'}
              </div>
            )}
            </div>
          </div>
        </div>
      </header>

      <div className="quiz-body practice-notes-quiz__body">
        <div
          className="quiz-card quiz-card--staff-fixed"
          style={{
            background: 'white',
            borderRadius: '32px',
            boxShadow: feedback === 'correct' ? '0 20px 40px rgba(16,185,129,0.15)' : feedback === 'wrong' ? '0 20px 40px rgba(239,68,68,0.15)' : '0 10px 40px rgba(0,0,0,0.04)',
            transform: feedback === 'wrong' ? 'translateX(10px)' : 'none',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease',
            border: '1px solid #f9fafb',
          }}
        >
          {solfege && (
            <div
              className={`quiz-solfege quiz-solfege--${solfege.tone}`}
              style={{ opacity: solfege.fading ? 0 : 1 }}
            >
              {solfege.label}
            </div>
          )}
          <div
            ref={containerRef}
            className="quiz-staff-slot"
            style={{ opacity: noteVisible ? 1 : 0, transition: 'opacity 0.3s ease' }}
          />
        </div>

        {usePiano ? (
          <FullPianoKeyboard onAnswer={handleAnswer} feedback={feedback} referencePitch={currentPitch} previewAudio />
        ) : (
          <div className="practice-notes-quiz__options">
            {[options.slice(0, 4), options.slice(4)].map((row, rowIdx) => (
              <div
                key={rowIdx}
                className={`practice-notes-quiz__options-row${row.length === 3 ? ' practice-notes-quiz__options-row--three' : ''}`}
              >
                {row.map(note => (
                  <button
                    key={note}
                    type="button"
                    className="practice-notes-quiz__option-btn"
                    onMouseDown={() => { if (audioEnabled) void audioEngine.prime(); }}
                    onClick={() => {
                      if (audioEnabled) {
                        void audioEngine.playNote(pitchForAnswerLetter(note, currentPitch), previewOpts);
                      }
                      handleAnswer(note);
                    }}
                  >
                    {note}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
