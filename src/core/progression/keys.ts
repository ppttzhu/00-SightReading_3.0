/**
 * Key pools and diatonic degree spelling for the RCM Level 6 chord-progression
 * exercise.
 *
 * This module is the Theory_Layer's source of truth for the supported major and
 * minor Key pools and for the correctly-spelled letter+accidental of each
 * diatonic scale degree in a Key. It is pure and framework-free (no React,
 * VexFlow, or Tone.js imports), mirroring the discipline of
 * `src/core/chords/chordCatalog.ts`.
 *
 * Spelling uses the standard circle-of-fifths key-signature model: every Key
 * maps to a signed number of accidentals (positive = sharps, negative = flats),
 * the accidentals apply to letters in the fixed sharp order (F C G D A E B) or
 * flat order (B E A D G C F), and the diatonic degrees are produced by walking
 * the seven letter names starting at the tonic's letter with the key signature
 * applied. Because the model is driven by spelled letters rather than pitch
 * classes, enharmonically equivalent Keys (C# major vs Db major) produce
 * distinct spellings.
 *
 * For minor Keys this returns the NATURAL minor spelling. The raised leading
 * tone required by a minor-key dominant (V) chord is applied later by the
 * Chord_Resolver from the Chord_Spec quality, and is intentionally NOT baked in
 * here.
 */

/**
 * Tonality of a question.
 *
 * This is the single canonical definition of `Mode` for the progression
 * feature; `progressions.ts` and the other progression core modules import
 * `Mode` FROM this module. It is defined here (rather than imported) so that
 * `keys.ts` has no forward dependency on `progressions.ts`.
 */
export type Mode = 'major' | 'minor';

/**
 * A tonic spelled as a letter name plus an optional accidental, for example
 * `"C"`, `"F#"`, `"Bb"`, or `"Cb"`. A `KeyName` carries no octave.
 */
export type KeyName = string;

/**
 * Supported major tonics, in the design's canonical order (Requirement 6.1).
 * Fifteen entries spanning sharp and flat Keys, including the enharmonic pair
 * F#/Gb and the theoretical Keys C# and Cb.
 */
export const MAJOR_KEYS: readonly KeyName[] = [
  'C',
  'G',
  'D',
  'A',
  'E',
  'B',
  'F#',
  'C#',
  'F',
  'Bb',
  'Eb',
  'Ab',
  'Db',
  'Gb',
  'Cb',
];

/**
 * Supported minor tonics, in the design's canonical order (Requirement 6.2).
 * Fifteen entries spanning sharp and flat Keys, including the theoretical Keys
 * G#, D#, and A#.
 */
export const MINOR_KEYS: readonly KeyName[] = [
  'A',
  'E',
  'B',
  'F#',
  'C#',
  'G#',
  'D#',
  'A#',
  'D',
  'G',
  'C',
  'F',
  'Bb',
  'Eb',
  'Ab',
];

/** Letter names in diatonic order (a full octave walk). */
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

/** Letter → its index within `LETTERS` (C = 0 … B = 6). */
const LETTER_INDEX: Record<string, number> = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6,
};

/**
 * The order in which sharps are added to a key signature (order of fifths up).
 * One sharp = F#; two = F#, C#; and so on.
 */
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'] as const;

/**
 * The order in which flats are added to a key signature (order of fifths down).
 * One flat = Bb; two = Bb, Eb; and so on.
 */
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'] as const;

/**
 * Signed count of accidentals for each supported MAJOR tonic on the circle of
 * fifths. Positive values are sharps, negative values are flats, `0` is C
 * major. Keyed by the spelled tonic so enharmonic Keys stay distinct (C# major
 * = 7 sharps, Db major = 5 flats).
 */
const MAJOR_KEY_SIGNATURE: Record<string, number> = {
  Cb: -7,
  Gb: -6,
  Db: -5,
  Ab: -4,
  Eb: -3,
  Bb: -2,
  F: -1,
  C: 0,
  G: 1,
  D: 2,
  A: 3,
  E: 4,
  B: 5,
  'F#': 6,
  'C#': 7,
};

/**
 * Signed count of accidentals for each supported MINOR tonic on the circle of
 * fifths (natural minor). A minor is `0`; sharp minors are positive, flat
 * minors negative. Keyed by the spelled tonic so enharmonic Keys stay distinct.
 */
const MINOR_KEY_SIGNATURE: Record<string, number> = {
  Ab: -7,
  Eb: -6,
  Bb: -5,
  F: -4,
  C: -3,
  G: -2,
  D: -1,
  A: 0,
  E: 1,
  B: 2,
  'F#': 3,
  'C#': 4,
  'G#': 5,
  'D#': 6,
  'A#': 7,
};

/**
 * Build the map from letter name to its signature accidental for a signed
 * accidental count. A positive count applies sharps in `SHARP_ORDER`; a
 * negative count applies flats in `FLAT_ORDER`; zero leaves every letter
 * natural. Letters not touched by the signature map to the empty string.
 */
function keySignatureAccidentals(signature: number): Record<string, string> {
  const accidentals: Record<string, string> = {
    C: '',
    D: '',
    E: '',
    F: '',
    G: '',
    A: '',
    B: '',
  };
  if (signature > 0) {
    for (let i = 0; i < signature; i += 1) {
      accidentals[SHARP_ORDER[i]] = '#';
    }
  } else if (signature < 0) {
    for (let i = 0; i < -signature; i += 1) {
      accidentals[FLAT_ORDER[i]] = 'b';
    }
  }
  return accidentals;
}

/**
 * The seven diatonic scale-degree spellings for a Key and Mode, ordered from
 * the tonic. Index `0` is degree 1 (the tonic), index `6` is degree 7. Each
 * entry is a Spelled_Pitch letter name plus optional accidental, with no
 * octave.
 *
 * The result is the source of truth for the letter name of each degree,
 * guaranteeing enharmonically correct spelling: for example F# major degree 4
 * is the letter `B` and degree 5 is `C#`; Eb major degree 5 is `Bb`. For minor
 * Keys the NATURAL minor spelling is returned (for example C# minor degree 7 is
 * `B`, not `B#`); the raised leading tone for a dominant chord is applied by the
 * Chord_Resolver, not here.
 *
 * @param key  the tonic, spelled as a letter plus optional accidental
 * @param mode `'major'` or `'minor'`
 * @returns the seven degree spellings, index 0 = tonic
 */
export function diatonicDegrees(key: KeyName, mode: Mode): string[] {
  const signature =
    mode === 'major' ? MAJOR_KEY_SIGNATURE[key] : MINOR_KEY_SIGNATURE[key];
  const accidentals = keySignatureAccidentals(signature ?? 0);

  const tonicLetter = key.charAt(0);
  const startIndex = LETTER_INDEX[tonicLetter] ?? 0;

  const degrees: string[] = [];
  for (let step = 0; step < 7; step += 1) {
    const letter = LETTERS[(startIndex + step) % 7];
    degrees.push(`${letter}${accidentals[letter]}`);
  }
  return degrees;
}

/**
 * The key signature for a Key and Mode, expressed both as a per-letter
 * accidental map (`''` | `'#'` | `'b'` for each of C–B) and as a VexFlow key
 * spec string (e.g. `"Eb"`, `"C#m"`, `"Am"`).
 *
 * The notation layer uses `perLetter` to suppress redundant note-level
 * accidentals (a tone whose accidental already matches the key signature draws
 * no symbol) and `vexKeySpec` to render the signature after the clef via
 * `Stave.addKeySignature`. See `key_signature_rules_for_ai.md`.
 */
export interface KeySignatureInfo {
  /** Letter (C–B) → its signature accidental: `''`, `'#'`, or `'b'`. */
  perLetter: Record<string, string>;
  /** VexFlow key spec: major keys like `"Eb"`, minor keys like `"Cm"`. */
  vexKeySpec: string;
}

/**
 * Resolve the {@link KeySignatureInfo} for a Key and Mode. Minor keys use the
 * natural-minor signature (same as the relative major); the raised leading tone
 * of a minor dominant is NOT part of the signature and is shown as a local
 * accidental by the notation layer.
 *
 * @param key  the tonic, spelled as a letter plus optional accidental
 * @param mode `'major'` or `'minor'`
 */
export function keySignatureFor(key: KeyName, mode: Mode): KeySignatureInfo {
  const signature =
    mode === 'major' ? MAJOR_KEY_SIGNATURE[key] : MINOR_KEY_SIGNATURE[key];
  return {
    perLetter: keySignatureAccidentals(signature ?? 0),
    vexKeySpec: mode === 'major' ? key : `${key}m`,
  };
}
