// Helpers for extracting the canonical answer (note name with accidental)
// from an A-type quiz pitch like "C#4", "Bb3", or "F4".

const PITCH_RE = /^([A-Ga-g])([#b]?)/;

export function extractNoteAnswer(pitch: string): string {
  const m = PITCH_RE.exec(pitch || '');
  if (!m) return '';
  return m[1].toUpperCase() + m[2];
}

// Enharmonic equivalences for the 5 black-key spellings.
const ENHARMONIC: Record<string, string> = {
  'C#': 'Db', 'Db': 'C#',
  'D#': 'Eb', 'Eb': 'D#',
  'F#': 'Gb', 'Gb': 'F#',
  'G#': 'Ab', 'Ab': 'G#',
  'A#': 'Bb', 'Bb': 'A#',
};

// True when a and b refer to the same pitch class. Used in piano-keyboard mode
// where black keys can only physically show one spelling; the user shouldn't
// be penalized for clicking the Db key when the answer is C# (or vice versa).
export function enharmonicEqual(a: string, b: string): boolean {
  return a === b || ENHARMONIC[a] === b;
}
