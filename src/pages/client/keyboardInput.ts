const NOTE_KEYS = new Set(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
const SHARP_KEYS = new Set(['#', '+', '=']);
const FLAT_KEYS = new Set(['-', '_']);

export function mapKeyToNote(key: string): string | null {
  if (key.length !== 1) return null;
  const upper = key.toUpperCase();
  return NOTE_KEYS.has(upper) ? upper : null;
}

export function isSharpKey(key: string): boolean {
  return SHARP_KEYS.has(key);
}

export function isFlatKey(key: string): boolean {
  return FLAT_KEYS.has(key);
}

// Resolves a small sequence of recently-pressed keys into a single note name
// like "C", "C#", or "Bb". Returns null if no valid note letter is present.
//
// Rules:
//   - Letters C-G/A-B (any case) are note letters; the LAST one wins.
//   - '#', '+', '=' are sharp aliases; '-', '_' are flat aliases.
//   - When both a sharp and flat appear, the LAST accidental wins.
//   - Special case for 'b' / 'B': it is the B-natural letter when no other
//     letter is in the buffer yet, but acts as a flat modifier once any
//     letter has been set (so 'D' then 'b' resolves to 'Db', and 'B' then
//     'b' resolves to 'Bb').
//   - Unrelated keys (Enter, Shift, digits, empty strings, etc.) are ignored.
export function parseNoteKeys(keys: string[]): string | null {
  let letter: string | null = null;
  let accidental: '' | '#' | 'b' = '';

  for (const k of keys) {
    if (!k) continue;
    if (k === 'b' || k === 'B') {
      if (letter === null) letter = 'B';
      else accidental = 'b';
      continue;
    }
    if (k.length === 1 && NOTE_KEYS.has(k.toUpperCase())) {
      letter = k.toUpperCase();
      continue;
    }
    if (SHARP_KEYS.has(k)) {
      accidental = '#';
      continue;
    }
    if (FLAT_KEYS.has(k)) {
      accidental = 'b';
      continue;
    }
  }

  if (!letter) return null;
  return letter + accidental;
}
