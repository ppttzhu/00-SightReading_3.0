import { useEffect, useState } from 'react';
import { formatTimeMs } from '../core/leaderboard/formatTime';

function urgencyStyle(elapsedMs: number): { color: string; background: string; borderColor: string } {
  const seconds = elapsedMs / 1000;
  if (seconds < 5) {
    return { color: '#059669', background: '#ecfdf5', borderColor: '#a7f3d0' };
  }
  if (seconds < 10) {
    return { color: '#d97706', background: '#fffbeb', borderColor: '#fcd34d' };
  }
  return { color: '#dc2626', background: '#fef2f2', borderColor: '#fca5a5' };
}

interface QuestionTimerProps {
  resetKey: number;
  paused?: boolean;
}

export default function QuestionTimer({ resetKey, paused = false }: QuestionTimerProps) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    setElapsedMs(0);
    if (paused) return;

    const start = Date.now();
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 100);

    return () => clearInterval(interval);
  }, [resetKey, paused]);

  const style = urgencyStyle(elapsedMs);
  const pulse = elapsedMs >= 10000 && !paused;

  return (
    <div
      className={`question-timer${pulse ? ' question-timer--urgent' : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        marginTop: '12px',
        padding: '6px 14px',
        borderRadius: '999px',
        fontSize: '0.95rem',
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        border: `1px solid ${style.borderColor}`,
        color: style.color,
        background: style.background,
        transition: 'color 0.3s, background 0.3s, border-color 0.3s',
      }}
    >
      <span aria-hidden>⏱</span>
      <span>{formatTimeMs(elapsedMs)}</span>
    </div>
  );
}
