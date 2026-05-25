import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Blink timer hook: shows content for `showMs`, hides for `hideMs`, repeating.
 * Resets the cycle whenever `resetDep` changes or `resetBlink()` is called manually.
 *
 * @param showMs  Duration (ms) the content stays visible before hiding.
 * @param hideMs  Duration (ms) the content stays hidden before showing again.
 * @param resetDep  A dependency value — when it changes, the blink cycle resets.
 * @returns { noteVisible, resetBlink }
 */
export function useBlinkTimer(showMs: number, hideMs: number, resetDep: unknown) {
  const [noteVisible, setNoteVisible] = useState(true);
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const resetBlink = useCallback(() => {
    if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
    setNoteVisible(true);
    const cycle = () => {
      blinkTimerRef.current = setTimeout(() => {
        setNoteVisible(false);
        blinkTimerRef.current = setTimeout(() => {
          setNoteVisible(true);
          cycle();
        }, hideMs);
      }, showMs);
    };
    cycle();
  }, [showMs, hideMs]);

  useEffect(() => {
    resetBlink();
    return () => { if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current); };
  }, [resetDep, resetBlink]);

  return { noteVisible, resetBlink };
}
