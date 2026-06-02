import { useState } from 'react';
import { NOTES_INPUT_MODE_KEY } from '../pages/client/StageSelector';

export function useNotesInputMode() {
  return useState(
    () => (localStorage.getItem(NOTES_INPUT_MODE_KEY) ?? 'options') === 'piano',
  );
}
