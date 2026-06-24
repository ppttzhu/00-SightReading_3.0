import { useState } from 'react';
import { NOTES_INPUT_MODE_KEY } from '../pages/client/StageSelector';

export type InputMode = 'options' | 'piano' | 'midi';

export function useNotesInputMode(): [InputMode, (mode: InputMode) => void] {
  const [mode, setMode] = useState<InputMode>(() => {
    const stored = localStorage.getItem(NOTES_INPUT_MODE_KEY);
    if (stored === 'piano' || stored === 'midi') return stored;
    return 'options';
  });

  const updateMode = (next: InputMode) => {
    setMode(next);
    localStorage.setItem(NOTES_INPUT_MODE_KEY, next);
  };

  return [mode, updateMode];
}
