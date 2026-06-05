import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { audioEngine } from '../core/engine/AudioEngine';

export type FeedbackState = 'none' | 'correct' | 'wrong';

type Key = {
  id: string;        // e.g. "C4", "C#4"
  letter: string;    // "C" | "C#" | … (sharp spelling)
  octave: number;    // 0-8
  isBlack: boolean;
  whiteIndex: number;
};

export type PianoZone = {
  label: string;
  start: string;
  end: string;
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
export const TOTAL_W = TOTAL_WHITE * WHITE_W;
const SVG_H = WHITE_H + LABEL_H;
const DRAG_THRESHOLD = 6;

export const PIANO_ZONES: PianoZone[] = [
  { label: 'A0-B1', start: 'A0', end: 'B1' },
  { label: 'C2-B2', start: 'C2', end: 'B2' },
  { label: 'C3-B3', start: 'C3', end: 'B3' },
  { label: 'C4-B4', start: 'C4', end: 'B4' },
  { label: 'C5-B5', start: 'C5', end: 'B5' },
  { label: 'C6-B6', start: 'C6', end: 'B6' },
  { label: 'C7-C8', start: 'C7', end: 'C8' },
];

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

export function getKeyCenterX(keyId: string): number {
  const key = ALL_KEYS.find(k => k.id === keyId);
  if (!key) return 0;
  return key.isBlack ? (key.whiteIndex + 1) * WHITE_W : key.whiteIndex * WHITE_W + WHITE_W / 2;
}

export function getZoneCenterX(zone: PianoZone): number {
  return (getKeyCenterX(zone.start) + getKeyCenterX(zone.end)) / 2;
}

export function getZoneScrollLeft(zone: PianoZone, viewportWidth: number): number {
  const maxScroll = Math.max(0, TOTAL_W - viewportWidth);
  return clamp(getZoneCenterX(zone) - viewportWidth / 2, 0, maxScroll);
}

export function getViewportFrame(scrollLeft: number, viewportWidth: number): { leftPct: number; widthPct: number } {
  const clampedWidth = clamp(viewportWidth, 0, TOTAL_W);
  const maxScroll = Math.max(0, TOTAL_W - clampedWidth);
  const clampedLeft = clamp(scrollLeft, 0, maxScroll);
  return {
    leftPct: (clampedLeft / TOTAL_W) * 100,
    widthPct: (clampedWidth / TOTAL_W) * 100,
  };
}

function getZoneFrame(zone: PianoZone): { leftPct: number; widthPct: number } {
  const startKey = ALL_KEYS.find(k => k.id === zone.start);
  const endKey = ALL_KEYS.find(k => k.id === zone.end);
  if (!startKey || !endKey) return { leftPct: 0, widthPct: 0 };
  const left = startKey.isBlack
    ? (startKey.whiteIndex + 1) * WHITE_W - BLACK_W / 2
    : startKey.whiteIndex * WHITE_W;
  const right = endKey.isBlack
    ? (endKey.whiteIndex + 1) * WHITE_W + BLACK_W / 2
    : (endKey.whiteIndex + 1) * WHITE_W;
  return {
    leftPct: (left / TOTAL_W) * 100,
    widthPct: ((right - left) / TOTAL_W) * 100,
  };
}

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
  const scrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedZoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Only meaningful while feedback is non-none; flashFill becomes null on
  // 'none', so the highlight disappears without explicit clearing.
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);
  const [viewportFrame, setViewportFrame] = useState(() => getViewportFrame(0, 0));
  const [thumbnailActive, setThumbnailActive] = useState(false);
  const [selectedZoneLabel, setSelectedZoneLabel] = useState<string | null>(null);

  const syncViewportFrame = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setViewportFrame(getViewportFrame(el.scrollLeft, el.clientWidth));
  }, []);

  // Center middle C (C4) on mount.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const c4 = ALL_KEYS.find(k => k.id === 'C4');
    if (!c4) return;
    const targetX = c4.whiteIndex * WHITE_W + WHITE_W / 2;
    el.scrollLeft = Math.max(0, targetX - el.clientWidth / 2);
    syncViewportFrame();
  }, [syncViewportFrame]);

  useEffect(() => {
    return () => {
      if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
      if (selectedZoneTimerRef.current) clearTimeout(selectedZoneTimerRef.current);
    };
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

  const handleZoneClick = (zone: PianoZone) => {
    const el = containerRef.current;
    if (!el) return;
    setSelectedZoneLabel(zone.label);
    if (selectedZoneTimerRef.current) clearTimeout(selectedZoneTimerRef.current);
    selectedZoneTimerRef.current = setTimeout(() => setSelectedZoneLabel(null), 900);
    const left = getZoneScrollLeft(zone, el.clientWidth);
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ left, behavior: 'smooth' });
    } else {
      el.scrollLeft = left;
    }
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

  const onScroll = () => {
    setThumbnailActive(true);
    setSelectedZoneLabel(null);
    syncViewportFrame();
    if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
    scrollIdleTimerRef.current = setTimeout(() => setThumbnailActive(false), 700);
    if (selectedZoneTimerRef.current) {
      clearTimeout(selectedZoneTimerRef.current);
      selectedZoneTimerRef.current = null;
    }
  };

  return (
    <div
      className="full-piano-keyboard"
      style={{
        width: '100%',
        maxWidth: TOTAL_W,
      }}
    >
      <div
        className={`full-piano-keyboard__thumbnail${thumbnailActive ? ' full-piano-keyboard__thumbnail--active' : ''}`}
        aria-label="钢琴音区导航"
      >
        <svg
          className="full-piano-keyboard__thumbnail-svg"
          width="100%"
          height="100%"
          viewBox={`0 0 ${TOTAL_W} 58`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {ALL_KEYS.filter(k => !k.isBlack).map(k => (
            <rect
              key={`mini-${k.id}`}
              x={k.whiteIndex * WHITE_W}
              y={6}
              width={WHITE_W - 1}
              height={38}
              fill="#ffffff"
              stroke="#d1d5db"
              strokeWidth={1}
              rx={2}
            />
          ))}
          {ALL_KEYS.filter(k => k.isBlack).map(k => (
            <rect
              key={`mini-${k.id}`}
              x={(k.whiteIndex + 1) * WHITE_W - BLACK_W / 2}
              y={6}
              width={BLACK_W}
              height={24}
              fill="#111827"
              rx={2}
            />
          ))}
        </svg>
        {PIANO_ZONES.map(zone => {
          const frame = getZoneFrame(zone);
          return (
            <button
              key={zone.label}
              type="button"
              aria-label={zone.label}
              className={`full-piano-keyboard__zone${selectedZoneLabel === zone.label ? ' full-piano-keyboard__zone--selected' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleZoneClick(zone);
              }}
              style={{
                position: 'absolute',
                left: `${frame.leftPct}%`,
                width: `${frame.widthPct}%`,
              }}
            >
              <span>{zone.label}</span>
            </button>
          );
        })}
        <div
          data-testid="piano-thumbnail-viewport"
          className={`full-piano-keyboard__viewport full-piano-keyboard__viewport--subtle${thumbnailActive ? ' full-piano-keyboard__viewport--visible' : ''}`}
          style={{
            left: `${viewportFrame.leftPct}%`,
            width: `${viewportFrame.widthPct}%`,
          }}
        />
      </div>
      <div
        ref={containerRef}
        data-testid="full-piano-scroll"
        onPointerDown={onPointerDown}
        onScroll={onScroll}
        className="full-piano-keyboard__scroll"
        style={{
          cursor: disabled ? 'default' : 'grab',
          opacity: disabled ? 0.85 : 1,
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
    </div>
  );
}
