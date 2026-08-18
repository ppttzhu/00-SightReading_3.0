/**
 * Progression definitions and reusable Chord_Spec building blocks for the RCM
 * Level 6 chord-progression exercise (the Progression_Layer).
 *
 * This module defines the four supported Level 6 Progressions as ordered
 * sequences of reusable {@link ChordSpec} objects, the four selectable
 * Roman-numeral {@link AnswerChoice} display strings, and the projection from a
 * spec sequence to its Answer_Choice. It is pure and framework-free (no React,
 * VexFlow, or Tone.js imports), mirroring the discipline of
 * `src/core/chords/chordCatalog.ts`.
 *
 * Chords are represented structurally as `{ degree, quality, inversion }`
 * rather than as Roman-numeral strings; the Roman numeral is a display
 * projection derived from the spec (see {@link toRomanNumerals}). Progressions
 * are compositions of the shared {@link CHORD_SPECS} building blocks, so a
 * future progression (e.g. `I – IV – V – I`) is a new ordered sequence only,
 * with no change to the Chord_Resolver (Requirement 13).
 *
 * The `Mode` type is owned by `./keys` (its canonical home); it is imported and
 * re-exported here so that other progression modules may import `Mode` from
 * either location.
 */

import type { Mode } from './keys';

/**
 * Re-export of the canonical {@link Mode} type owned by `./keys`, provided for
 * convenience so callers can import `Mode` alongside the progression types.
 */
export type { Mode } from './keys';

/**
 * Functional class of the middle chord of a Progression: the subdominant (IV /
 * iv) or the dominant (V).
 */
export type HarmonicFunction = 'subdominant' | 'dominant';

/** Triad quality. Level 6 uses only major and minor triads. */
export type ChordQuality = 'major' | 'minor';

/**
 * One of the four selectable Roman-numeral display strings shown to the
 * student. The separator is an EN DASH (U+2013) surrounded by single spaces.
 */
export type AnswerChoice = 'I – IV – I' | 'I – V – I' | 'i – iv – i' | 'i – V – i';

/**
 * Stable identifier for a supported Progression, used as the scope token in the
 * navigation query string and for answer-option selection. One per
 * `(mode, function)` pair.
 */
export type ProgressionId = 'maj_sub' | 'maj_dom' | 'min_sub' | 'min_dom';

/**
 * A chord represented structurally rather than as a Roman-numeral string.
 *
 * The Chord_Resolver builds the triad's tones from the {@link ChordSpec.quality}
 * field, not from unaltered natural-scale degrees, so a minor-key dominant
 * (`degree 5, quality 'major'`) resolves to a major triad on the raised leading
 * tone.
 */
export interface ChordSpec {
  /** Scale-degree number the chord is built on (1..7). */
  degree: number;
  /** Triad quality; the Chord_Resolver builds tones from THIS field. */
  quality: ChordQuality;
  /** 0 = root position. 1/2 reserved for future inversions (unused at L6). */
  inversion: 0 | 1 | 2;
}

/**
 * A supported Level 6 Progression: an ordered sequence of reusable
 * {@link ChordSpec} references plus the Roman-numeral {@link AnswerChoice} that
 * is both its display projection and its correct-answer identity.
 */
export interface ProgressionDef {
  /** Stable id used for scope selection and URL serialization. */
  id: ProgressionId;
  /** Tonality the progression belongs to. */
  mode: Mode;
  /** Functional class of the middle chord. */
  function: HarmonicFunction;
  /** Ordered Chord_Spec references (three entries at Level 6). */
  specs: readonly ChordSpec[];
  /** The Roman-numeral display projection (also the correct Answer_Choice). */
  answer: AnswerChoice;
}

/**
 * The five reusable Level 6 Chord_Spec building blocks, shared across the
 * supported Progressions (Requirement 13.1). `I`, `IV`, and `V` are the major
 * triads used in major keys and (for `V`) the raised-leading-tone dominant of
 * minor keys; `i` and `iv` are the minor tonic and subdominant.
 */
export const CHORD_SPECS: {
  I: ChordSpec;
  IV: ChordSpec;
  V: ChordSpec;
  i: ChordSpec;
  iv: ChordSpec;
} = {
  I: { degree: 1, quality: 'major', inversion: 0 },
  IV: { degree: 4, quality: 'major', inversion: 0 },
  V: { degree: 5, quality: 'major', inversion: 0 },
  i: { degree: 1, quality: 'minor', inversion: 0 },
  iv: { degree: 4, quality: 'minor', inversion: 0 },
};

/**
 * The four supported Level 6 Progressions, composed from {@link CHORD_SPECS}
 * (Requirements 1.1, 1.2, 2.4–2.7). The `(mode, function)` pair uniquely
 * determines each entry.
 *
 * Note that the minor-dominant row references the MAJOR `V` spec
 * (`quality: 'major'`), which is what forces the Chord_Resolver to raise the
 * leading tone (A minor V = `E–G#–B`, never `E–G–B`).
 */
export const LEVEL6_PROGRESSIONS: readonly ProgressionDef[] = [
  {
    id: 'maj_sub',
    mode: 'major',
    function: 'subdominant',
    specs: [CHORD_SPECS.I, CHORD_SPECS.IV, CHORD_SPECS.I],
    answer: 'I – IV – I',
  },
  {
    id: 'maj_dom',
    mode: 'major',
    function: 'dominant',
    specs: [CHORD_SPECS.I, CHORD_SPECS.V, CHORD_SPECS.I],
    answer: 'I – V – I',
  },
  {
    id: 'min_sub',
    mode: 'minor',
    function: 'subdominant',
    specs: [CHORD_SPECS.i, CHORD_SPECS.iv, CHORD_SPECS.i],
    answer: 'i – iv – i',
  },
  {
    id: 'min_dom',
    mode: 'minor',
    function: 'dominant',
    // References the MAJOR V spec → raised leading tone in the resolver.
    specs: [CHORD_SPECS.i, CHORD_SPECS.V, CHORD_SPECS.i],
    answer: 'i – V – i',
  },
];

/** Lookup map from ProgressionId to its ProgressionDef. */
export const PROGRESSION_BY_ID: ReadonlyMap<ProgressionId, ProgressionDef> =
  new Map(LEVEL6_PROGRESSIONS.map((p) => [p.id, p]));

/**
 * The four {@link AnswerChoice}s, in fixed display order (Requirement 9.1).
 * The Presentation_Layer renders these in this order regardless of the current
 * question.
 */
export const ANSWER_CHOICES: readonly AnswerChoice[] = [
  'I – IV – I',
  'I – V – I',
  'i – iv – i',
  'i – V – i',
];

/** The separator between Roman numerals in an {@link AnswerChoice}: space, EN DASH (U+2013), space. */
const ROMAN_SEPARATOR = ' – ';

/** Roman-numeral letters for the degrees used at Level 6, in UPPERCASE form. */
const DEGREE_ROMAN: Record<number, string> = {
  1: 'I',
  4: 'IV',
  5: 'V',
};

/**
 * Project a single {@link ChordSpec} to its Roman numeral: the uppercase
 * numeral for the chord's degree, lowercased when the quality is minor.
 */
function specToRoman(spec: ChordSpec): string {
  const numeral = DEGREE_ROMAN[spec.degree];
  return spec.quality === 'minor' ? numeral.toLowerCase() : numeral;
}

/**
 * Project a Chord_Spec sequence to its Roman-numeral {@link AnswerChoice}
 * (Requirement 12.5). Each spec becomes a numeral (degree 1 → I/i, 4 → IV/iv,
 * 5 → V), uppercase when its quality is `'major'` and lowercase when `'minor'`,
 * joined by ` – ` (space, EN DASH, space).
 *
 * For the four supported Progressions this returns their exact
 * {@link AnswerChoice}. In particular the minor `i – V – i` progression has a
 * `V` spec of quality `'major'`, so its middle numeral is the uppercase `V`,
 * yielding `'i – V – i'`.
 *
 * @param specs an ordered Chord_Spec sequence
 * @returns the matching Answer_Choice string
 */
export function toRomanNumerals(specs: readonly ChordSpec[]): AnswerChoice {
  return specs.map(specToRoman).join(ROMAN_SEPARATOR) as AnswerChoice;
}
