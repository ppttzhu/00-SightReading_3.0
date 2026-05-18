import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'vexflow';
import { NOTES_INPUT_MODE_KEY } from './StageSelector';
import FullPianoKeyboard from '../../components/FullPianoKeyboard';
import { audioEngine } from '../../core/engine/AudioEngine';
import { getAutomaticClefForPitch, pitchForAnswerLetter, pitchToStaffNum } from '../../core/engine/pitchUtils';

const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

function parsePitchForVexflow(pitchStr: string): { key: string; accidental: string | null } {
  const match = pitchStr.match(/^([A-Ga-g])(#|b)?(\d)$/);
  if (!match) return { key: 'c/4', accidental: null };
  return {
    key: `${match[1].toLowerCase()}/${match[3]}`,
    accidental: match[2] || null
  };
}

// Generate a random pitch between low and high (inclusive), avoiding prev
function randomPitch(low: string, high: string, prev?: string): string {
  const lowNum = pitchToStaffNum(low);
  const highNum = pitchToStaffNum(high);
  if (highNum <= lowNum) return low;

  const noteNames = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  let pitch = '';
  let attempts = 0;
  do {
    const target = lowNum + Math.floor(Math.random() * (highNum - lowNum + 1));
    const octave = Math.floor(target / 7);
    const noteIdx = target % 7;
    pitch = `${noteNames[noteIdx]}${octave}`;
    attempts++;
  } while (pitch === prev && attempts < 20);
  return pitch;
}

// Determine clef based on pitch
function getClef(pitch: string): string {
  return getAutomaticClefForPitch(pitch);
}

export default function PracticeQuiz() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);

  const low = searchParams.get('low') || 'C2';
  const high = searchParams.get('high') || 'C6';

  const usePiano = (localStorage.getItem(NOTES_INPUT_MODE_KEY) ?? 'options') === 'piano';

  const [currentPitch, setCurrentPitch] = useState(() => randomPitch(low, high));
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [noteVisible, setNoteVisible] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(audioEngine.enabled);
  const [showAudioTip, setShowAudioTip] = useState(true);
  const [tipFading, setTipFading] = useState(false);
  useEffect(() => {
    setTipFading(false);
    const t1 = setTimeout(() => setTipFading(true), 3000);
    const t2 = setTimeout(() => setShowAudioTip(false), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [showAudioTip]);

  const clef = useMemo(() => getClef(currentPitch), [currentPitch]);

  const nextQuestion = useCallback(() => {
    setCurrentPitch(randomPitch(low, high, currentPitch));
    setNoteVisible(true);
  }, [low, high, currentPitch]);

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
  }, [currentPitch]);

  // Render VexFlow
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
    const width = Math.min(500, containerRef.current.clientWidth - 20);
    renderer.resize(width, 200);
    const context = renderer.getContext();

    const stave = new Stave(10, 40, width - 40);
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
    const correct = currentPitch.charAt(0).toUpperCase();
    const isCorrect = answer === correct;

    setTotal(t => t + 1);
    if (isCorrect) {
      setScore(s => s + 1);
      setFeedback('correct');
      setTimeout(() => {
        audioEngine.stop();
        setFeedback('none');
        nextQuestion();
      }, 600);
    } else {
      setFeedback('wrong');
      setTimeout(() => setFeedback('none'), 500);
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
          <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>
            音域: {low} — {high}
          </span>
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
                {audioEnabled ? '音效已开启，答题时会播放音符声音' : '音效已关闭'}
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
            marginBottom: '60px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '500px',
            minHeight: '180px',
            transform: feedback === 'wrong' ? 'translateX(10px)' : 'none',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            border: '1px solid #f9fafb'
          }}
        >
          <div ref={containerRef} style={{ opacity: noteVisible ? 1 : 0, transition: 'opacity 0.3s ease' }}></div>
        </div>

        {usePiano ? (
          <FullPianoKeyboard onAnswer={handleAnswer} feedback={feedback} referencePitch={currentPitch} />
        ) : (
          <div className="quiz-options" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {NOTE_NAMES.map(note => (
              <button
                key={note}
                onMouseDown={() => { if (audioEnabled) void audioEngine.prime(); }}
                onClick={() => {
                  void audioEngine.playNote(pitchForAnswerLetter(note, currentPitch));
                  handleAnswer(note);
                }}
                style={{
                  width: '64px', height: '64px', borderRadius: '16px',
                  border: '1px solid #f3f4f6', background: 'white',
                  fontSize: '1.6rem', fontWeight: '700', color: '#374151',
                  cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 12px 20px rgba(0,0,0,0.06)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.03)';
                }}
              >
                {note}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
