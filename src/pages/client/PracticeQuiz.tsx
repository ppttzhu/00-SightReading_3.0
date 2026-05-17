import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'vexflow';
import { NOTES_INPUT_MODE_KEY } from './StageSelector';

const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

const WHITE_KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
function PianoKeyboard({ onAnswer }: { onAnswer: (note: string) => void }) {
  const whiteW = 44, whiteH = 120, blackW = 28, blackH = 75;
  const whites = WHITE_KEYS;
  const blacks: { name: string; pos: number }[] = [
    { name: 'C#', pos: 1 }, { name: 'D#', pos: 2 },
    { name: 'F#', pos: 4 }, { name: 'G#', pos: 5 }, { name: 'A#', pos: 6 },
  ];
  const totalW = whites.length * whiteW;

  return (
    <svg width={totalW} height={whiteH + 2} style={{ display: 'block', cursor: 'pointer' }}>
      {whites.map((name, i) => (
        <g key={name} onClick={() => onAnswer(name)} style={{ cursor: 'pointer' }}>
          <rect x={i * whiteW} y={0} width={whiteW - 2} height={whiteH}
            fill="white" stroke="#d1d5db" strokeWidth={1.5} rx={4} />
        </g>
      ))}
      {blacks.map(({ name, pos }) => (
        <g key={name} onClick={() => onAnswer(name.charAt(0))} style={{ cursor: 'pointer' }}>
          <rect x={pos * whiteW - blackW / 2} y={0} width={blackW} height={blackH}
            fill="#1f2937" rx={4} />
        </g>
      ))}
    </svg>
  );
}

function parsePitchForVexflow(pitchStr: string): { key: string; accidental: string | null } {
  const match = pitchStr.match(/^([A-Ga-g])(#|b)?(\d)$/);
  if (!match) return { key: 'c/4', accidental: null };
  return {
    key: `${match[1].toLowerCase()}/${match[3]}`,
    accidental: match[2] || null
  };
}

// Convert pitch string to numeric value for comparison
function pitchToNum(pitch: string): number {
  const noteVal: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
  const note = pitch.charAt(0).toUpperCase();
  const octave = parseInt(pitch.charAt(1) || pitch.charAt(pitch.length - 1));
  return octave * 7 + (noteVal[note] || 0);
}

// Generate a random pitch between low and high (inclusive), avoiding prev
function randomPitch(low: string, high: string, prev?: string): string {
  const lowNum = pitchToNum(low);
  const highNum = pitchToNum(high);
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
  const num = pitchToNum(pitch);
  const e4Num = pitchToNum('E4');
  const a3Num = pitchToNum('A3');

  if (num >= e4Num) return 'treble';
  if (num <= a3Num) return 'bass';
  return Math.random() > 0.5 ? 'treble' : 'bass';
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
          <PianoKeyboard onAnswer={handleAnswer} />
        ) : (
          <div className="quiz-options" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {NOTE_NAMES.map(note => (
              <button
                key={note}
                onClick={() => handleAnswer(note)}
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
