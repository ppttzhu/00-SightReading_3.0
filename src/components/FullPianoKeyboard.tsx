import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { audioEngine } from '../core/engine/AudioEngine';

export type FeedbackState = 'none' | 'correct' | 'wrong';

type Key = {
  id: string;        // e.g. "C4", "C#4"
  letter: string;    // "C" | "C#" | … (sharp spelling)
  octave: number;    // 0-8
  isBlack: boolean;
  whiteIndex: number;
};

// Standard 88-key piano: A0 through C8.
function buildKeys(): Key[] {
  const seq = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const keys: Key[] = [];
  let whiteIndex = 0;
  let lastWhiteIndex = -1;
  let octave = 0;
  let i = 9; // start at A0
  while (true) {
    const letter = seq[i];
    const isBlack = letter.includes('#');
    if (isBlack) {
      keys.push({ id: `${letter}${octave}`, letter, octave, isBlack: true, whiteIndex: lastWhiteIndex });
    } else {
      keys.push({ id: `${letter}${octave}`, letter, octave, isBlack: false, whiteIndex });
      lastWhiteIndex = whiteIndex;
      whiteIndex++;
    }
    if (letter === 'C' && octave === 8) break;
    i++;
    if (i >= 12) { i = 0; octave++; }
  }
  return keys;
}

const ALL_KEYS = buildKeys();
const TOTAL_WHITE = ALL_KEYS.filter(k => !k.isBlack).length; // 52
const WHITE_W = 44;
const WHITE_H = 120;
const BLACK_W = 28;
const BLACK_H = 75;
const LABEL_H = 22;
const TOTAL_W = TOTAL_WHITE * WHITE_W;
const SVG_H = WHITE_H + LABEL_H;
const DRAG_THRESHOLD = 6;

interface Props {
  onAnswer: (note: string) => void;
  feedback: FeedbackState;
  /** Accepted for API parity with the single-octave PianoKeyboard; the full
   *  keyboard plays the clicked key's actual pitch and does not need this. */
  referencePitch?: string;
  /** 预览模式：短促发声并触发 start/fade/end 生命周期事件 */
  previewAudio?: boolean;
}

export default function FullPianoKeyboard({ onAnswer, feedback, previewAudio = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const suppressClickRef = useRef(false);
  // Only meaningful while feedback is non-none; flashFill becomes null on
  // 'none', so the highlight disappears without explicit clearing.
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);

  // Center middle C (C4) on mount.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const c4 = ALL_KEYS.find(k => k.id === 'C4');
    if (!c4) return;
    const targetX = c4.whiteIndex * WHITE_W + WHITE_W / 2;
    el.scrollLeft = Math.max(0, targetX - el.clientWidth / 2);
  }, []);

  const disabled = feedback !== 'none';
  const flashFill = feedback === 'correct' ? '#10b981' : feedback === 'wrong' ? '#ef4444' : null;

  const handleClick = (k: Key) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (disabled) return;
    setLastClickedId(k.id);
    void audioEngine.playNote(k.id, previewAudio ? { preview: true } : undefined);
    onAnswer(k.id);
  };

  // Mouse-only drag-to-pan. Avoid setPointerCapture: it retargets the
  // subsequent click event to the captured container, breaking per-key onClick.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    const el = containerRef.current;
    if (!el) return;
    suppressClickRef.current = false;
    if (audioEngine.enabled) void audioEngine.prime();
    const startX = e.clientX;
    const startScroll = el.scrollLeft;
    let dragged = false;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (Math.abs(dx) > DRAG_THRESHOLD) dragged = true;
      if (dragged) {
        el.scrollLeft = startScroll - dx;
        ev.preventDefault();
      }
    };
    const onUp = () => {
      if (dragged) suppressClickRef.current = true;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      style={{
        width: '100%',
        maxWidth: TOTAL_W,
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-x',
        userSelect: 'none',
        cursor: disabled ? 'default' : 'grab',
        opacity: disabled ? 0.85 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      <svg width={TOTAL_W} height={SVG_H} style={{ display: 'block' }}>
        {ALL_KEYS.filter(k => !k.isBlack).map(k => {
          const x = k.whiteIndex * WHITE_W;
          const active = lastClickedId === k.id && flashFill !== null;
          const isMiddleC = k.id === 'C4';
          return (
            <g
              key={k.id}
              onClick={() => handleClick(k)}
              style={{ cursor: disabled ? 'default' : 'pointer' }}
            >
              <rect
                x={x} y={0}
                width={WHITE_W - 2} height={WHITE_H}
                fill={active ? flashFill! : 'white'}
                stroke={active ? flashFill! : '#d1d5db'}
                strokeWidth={1.5}
                rx={4}
                style={{ transition: 'fill 0.2s ease, stroke 0.2s ease' }}
              />
              {k.letter === 'C' && (
                <text
                  x={x + (WHITE_W - 2) / 2}
                  y={WHITE_H + 14}
                  textAnchor="middle"
                  fontSize={11}
                  fill={isMiddleC ? '#2563eb' : '#9ca3af'}
                  fontWeight={isMiddleC ? 700 : 500}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {k.id}
                </text>
              )}
              {isMiddleC && (
                <circle
                  cx={x + (WHITE_W - 2) / 2}
                  cy={WHITE_H - 14}
                  r={3.5}
                  fill="#2563eb"
                  style={{ pointerEvents: 'none' }}
                />
              )}
            </g>
          );
        })}
        {ALL_KEYS.filter(k => k.isBlack).map(k => {
          const x = (k.whiteIndex + 1) * WHITE_W - BLACK_W / 2;
          const active = lastClickedId === k.id && flashFill !== null;
          return (
            <g
              key={k.id}
              onClick={() => handleClick(k)}
              style={{ cursor: disabled ? 'default' : 'pointer' }}
            >
              <rect
                x={x} y={0}
                width={BLACK_W} height={BLACK_H}
                fill={active ? flashFill! : '#1f2937'}
                rx={4}
                style={{ transition: 'fill 0.2s ease' }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
