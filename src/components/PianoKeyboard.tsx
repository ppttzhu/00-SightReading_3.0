import { useState, useCallback, useEffect, useRef } from 'react';
import { audioEngine } from '../core/engine/AudioEngine';
import { getOctaveFromPitch, pitchAtOctave } from '../core/engine/pitchUtils';

export type FeedbackState = 'none' | 'correct' | 'wrong';

interface PianoKeyboardProps {
  onAnswer: (note: string) => void;
  feedback: FeedbackState;
  referencePitch?: string;
}

const WHITE_KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_KEYS = [
  { name: 'C#', pos: 1 },
  { name: 'D#', pos: 2 },
  { name: 'F#', pos: 4 },
  { name: 'G#', pos: 5 },
  { name: 'A#', pos: 6 },
];

const W = 44, WH = 120, BW = 28, BH = 75;

export default function PianoKeyboard({ onAnswer, feedback, referencePitch = 'C4' }: PianoKeyboardProps) {
  const octave = getOctaveFromPitch(referencePitch);
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [lastAnsweredKey, setLastAnsweredKey] = useState<string | null>(null);
  const feedbackRef = useRef(feedback);
  feedbackRef.current = feedback;

  // 反馈结束后清除高亮
  useEffect(() => {
    if (feedback === 'none') {
      setLastAnsweredKey(null);
    }
  }, [feedback]);

  const disabled = feedback !== 'none';

  const handlePress = useCallback((note: string) => {
    if (disabled) return;
    if (audioEngine.enabled) void audioEngine.prime();
    setPressedKey(note);
  }, [disabled]);

  const handleRelease = useCallback(() => {
    setPressedKey(null);
  }, []);

  const handleClick = useCallback((note: string) => {
    if (disabled) return;
    setPressedKey(null);
    setLastAnsweredKey(note);
    void audioEngine.playNote(pitchAtOctave(note, octave));
    onAnswer(note);
  }, [disabled, onAnswer, octave]);

  // ---- 白键颜色 ----
  const whiteFill = (name: string) => {
    if (feedback !== 'none' && lastAnsweredKey === name) {
      return feedback === 'correct' ? '#d1fae5' : '#fee2e2';
    }
    if (pressedKey === name) return '#e5e7eb';
    return 'white';
  };

  const whiteStroke = (name: string) => {
    if (feedback !== 'none' && lastAnsweredKey === name) {
      return feedback === 'correct' ? '#34d399' : '#f87171';
    }
    return '#d1d5db';
  };

  // ---- 黑键颜色 ----
  const blackFill = (name: string) => {
    if (feedback !== 'none' && lastAnsweredKey === name) {
      return feedback === 'correct' ? '#065f46' : '#991b1b';
    }
    if (pressedKey === name) return '#374151';
    return '#1f2937';
  };

  const totalW = WHITE_KEYS.length * W;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
    <svg
      width={totalW}
      height={WH + 20}
      style={{ display: 'block', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1, transition: 'opacity 0.2s' }}
      onMouseUp={handleRelease}
      onMouseLeave={handleRelease}
    >
      {/* 白键 */}
      {WHITE_KEYS.map((name, i) => {
        const isPressed = pressedKey === name;
        return (
          <g
            key={name}
            style={{ cursor: disabled ? 'default' : 'pointer' }}
            onMouseDown={() => handlePress(name)}
            onMouseUp={handleRelease}
            onMouseLeave={handleRelease}
            onTouchStart={(e) => { e.preventDefault(); handlePress(name); }}
            onTouchEnd={(e) => { e.preventDefault(); handleClick(name); }}
            onClick={() => handleClick(name)}
          >
            <rect
              x={i * W}
              y={isPressed ? 2 : 0}
              width={W - 2}
              height={WH}
              fill={whiteFill(name)}
              stroke={whiteStroke(name)}
              strokeWidth={1.5}
              rx={4}
              style={{ transition: 'fill 0.1s ease, stroke 0.15s ease' }}
            />
            <text
              x={i * W + (W - 2) / 2}
              y={WH - 12}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill="#9ca3af"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {name}
            </text>
          </g>
        );
      })}

      {/* 黑键 */}
      {BLACK_KEYS.map(({ name, pos }) => {
        const isPressed = pressedKey === name;
        return (
          <g
            key={name}
            style={{ cursor: disabled ? 'default' : 'pointer' }}
            onMouseDown={() => handlePress(name)}
            onMouseUp={handleRelease}
            onMouseLeave={handleRelease}
            onTouchStart={(e) => { e.preventDefault(); handlePress(name); }}
            onTouchEnd={(e) => { e.preventDefault(); handleClick(name); }}
            onClick={() => handleClick(name)}
          >
            <rect
              x={pos * W - BW / 2}
              y={isPressed ? 2 : 0}
              width={BW}
              height={BH}
              fill={blackFill(name)}
              rx={4}
              style={{ transition: 'fill 0.1s ease' }}
            />
            <text
              x={pos * W}
              y={BH - 10}
              textAnchor="middle"
              fontSize={10}
              fontWeight={700}
              fill="white"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {name}
            </text>
          </g>
        );
      })}
    </svg>
      <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
        {pitchAtOctave('C', octave)} – {pitchAtOctave('B', octave)}
      </span>
    </div>
  );
}
