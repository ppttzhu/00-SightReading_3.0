/**
 * Key theory for the RCM Level 6 Playback exercise: key signatures (for
 * notation), diatonic scale-degree → pitch conversion (for the generator), and
 * the tonic chord voicing. Pure and framework-free.
 *
 * Supports exactly the four syllabus keys: G major, E major, G minor, E minor.
 */

import type { PlaybackKey } from './playbackTypes';

/** Letters in diatonic order. */
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
/** Natural semitone offset of each letter within an octave. */
const LETTER_SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** Letter → its index (C=0..B=6). */
const LETTER_INDEX: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

/**
 * Key signature info: the per-letter accidental map (`''`/`'#'`/`'b'`), the
 * VexFlow key spec (e.g. `"G"`, `"Em"`), and the tonic letter.
 */
export interface PlaybackKeyInfo {
  tonicLetter: string;
  perLetter: Record<string, string>;
  vexKeySpec: string;
}

/**
 * Per-key signatures. Minor keys use the natural-minor (relative-major)
 * signature; the raised leading tone is applied as a note-level accidental by
 * the caller, not baked into the signature.
 */
const KEY_INFO: Record<PlaybackKey, PlaybackKeyInfo> = {
  'G major': { tonicLetter: 'G', perLetter: sig({ F: '#' }), vexKeySpec: 'G' },
  'E major': { tonicLetter: 'E', perLetter: sig({ F: '#', C: '#', G: '#', D: '#' }), vexKeySpec: 'E' },
  'G minor': { tonicLetter: 'G', perLetter: sig({ B: 'b', E: 'b' }), vexKeySpec: 'Gm' },
  'E minor': { tonicLetter: 'E', perLetter: sig({ F: '#' }), vexKeySpec: 'Em' },
};

/** Build a full per-letter accidental map from the non-natural letters. */
function sig(alt: Record<string, string>): Record<string, string> {
  const base: Record<string, string> = { C: '', D: '', E: '', F: '', G: '', A: '', B: '' };
  return { ...base, ...alt };
}

/** Get the {@link PlaybackKeyInfo} for a key. */
export function keyInfo(key: PlaybackKey): PlaybackKeyInfo {
  return KEY_INFO[key];
}

/**
 * MIDI value of a spelled pitch like "F#4", "Bb3", "G5".
 */
export function pitchToMidi(pitch: string): number {
  const m = pitch.match(/^([A-G])(##|bb|#|b|n)?(-?\d+)$/);
  if (!m) return 60;
  const acc = m[2] === '#' ? 1 : m[2] === '##' ? 2 : m[2] === 'b' ? -1 : m[2] === 'bb' ? -2 : 0;
  return LETTER_SEMITONE[m[1]] + acc + (parseInt(m[3], 10) + 1) * 12;
}

/**
 * The diatonic pitch for a scale degree (1..8) in a key, at a chosen octave for
 * degree 1. Degrees above 7 wrap to the next octave (8 = upper tonic). The
 * spelling uses the key signature so accidentals are correct (F# major etc.).
 * The raised leading tone for minor keys is NOT applied here — callers request
 * it explicitly via {@link raisedLeadingTone}.
 *
 * @param key         the key
 * @param degree      scale degree 1..8 (8 = tonic one octave up)
 * @param tonicOctave the octave of degree 1
 */
export function degreeToPitch(key: PlaybackKey, degree: number, tonicOctave: number): string {
  const info = KEY_INFO[key];
  const tonicIdx = LETTER_INDEX[info.tonicLetter];
  const step = degree - 1; // 0-based diatonic steps above the tonic
  const letterIdx = (tonicIdx + step) % 7;
  const letter = LETTERS[letterIdx];
  const octave = tonicOctave + Math.floor((tonicIdx + step) / 7);
  const accidental = info.perLetter[letter] ?? '';
  return `${letter}${accidental}${octave}`;
}

/**
 * The raised leading tone (scale degree 7 raised a semitone) for a minor key,
 * at the octave just below the given tonic octave's upper tonic. For G minor
 * this is F#; for E minor, D#. Returns the spelled pitch at `octave`.
 */
export function raisedLeadingTone(key: PlaybackKey, octave: number): string {
  // Degree 7 natural, then raise by a semitone (respell the same letter with #
  // unless the natural already carries a flat, in which case it becomes natural).
  const natural = degreeToPitch(key, 7, octave);
  const m = natural.match(/^([A-G])(b|bb|#|##)?(-?\d+)$/)!;
  const letter = m[1];
  const acc = m[2] ?? '';
  const oct = m[3];
  if (acc === 'b') return `${letter}${oct}`; // Bb -> B natural
  if (acc === '') return `${letter}#${oct}`; // F -> F#
  if (acc === 'bb') return `${letter}b${oct}`;
  return `${letter}##${oct}`;
}

/**
 * The tonic chord voicing (root, third, fifth, upper root) per RCM §14, in the
 * standard register from the CSV reference (root at octave 4).
 */
export function tonicChord(key: PlaybackKey): string[] {
  const TONICS: Record<PlaybackKey, string[]> = {
    'G major': ['G4', 'B4', 'D5', 'G5'],
    'E major': ['E4', 'G#4', 'B4', 'E5'],
    'G minor': ['G4', 'Bb4', 'D5', 'G5'],
    'E minor': ['E4', 'G4', 'B4', 'E5'],
  };
  return TONICS[key];
}
