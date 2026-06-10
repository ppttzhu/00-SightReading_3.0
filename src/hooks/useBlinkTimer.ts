import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * Blink timer hook: shows content for `showMs`, hides for `hideMs`, repeating.
 * Resets the cycle whenever `resetDep` changes or `resetBlink()` is called manually.
 * When `skip` is true, notes stay visible and no blink cycle runs.
 *
 * @param showMs  Duration (ms) the content stays visible before hiding.
 * @param hideMs  Duration (ms) the content stays hidden before showing again.
 * @param resetDep  A dependency value — when it changes, the blink cycle resets.
 * @param skip  When true, notes stay visible and no blink cycle runs.
 * @returns { noteVisible, resetBlink }
 */
export function useBlinkTimer(showMs: number, hideMs: number, resetDep: unknown, skip = false) {
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

  useLayoutEffect(() => {
    if (skip) {
      setNoteVisible(true);
      return;
    }
    resetBlink();
    return () => { if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current); };
  }, [resetDep, resetBlink, skip]);

  return { noteVisible: skip ? true : noteVisible, resetBlink };
}
