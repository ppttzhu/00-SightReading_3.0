/**
 * Interval question generation and enharmonic-correct spelling.
 *
 * This module is pure and framework-free. It builds on the canonical
 * `intervalCatalog` to spell, place, generate, and validate interval
 * questions for the theory practice screen.
 *
 * NOTE: This file is grown incrementally across tasks. This task implements
 * the shared question/result types and the pure `spellInterval` function.
 * The sibling helpers `verifySpelling`, `validateQuestion`, and
 * `generateQuestion` are implemented in later tasks and extend this file.
 */

import type { CatalogInterval } from './intervalCatalog';
import { CATALOG_BY_ID } from './intervalCatalog';
import type { Subset } from './intervalSelection';

// ============================================================
// Types
// ============================================================

/**
 * A fully-specified interval question. Every fact needed to name, render,
 * play, and grade the question is stored explicitly so the piano MIDI values
 * are never the sole source of the interval's name — enharmonic-correct
 * spelling is always preserved in the pitch strings.
 */
export interface IntervalQuestion {
  /** Target interval identity (id / name / number / quality / semitones). */
  interval: CatalogInterval;
  /** Spelled starting note, e.g. "F#4" (letter + accidental + octave). */
  startPitch: string;
  /** Spelled ending note, e.g. "B4". */
  endPitch: string;
  /** Starting note MIDI. */
  startMidi: number;
  /** Ending note MIDI. */
  endMidi: number;
  /** Lower-sounding spelled note (for staff/order convenience). */
  lowPitch: string;
  /** Higher-sounding spelled note. */
  highPitch: string;
  /** = min(startMidi, endMidi). */
  lowMidi: number;
  /** = max(startMidi, endMidi). */
  highMidi: number;
  /** = |highMidi - lowMidi|; stored explicitly, always == interval.semitones. */
  semitoneDistance: number;
  clef: 'treble' | 'bass';
  /** Melodic (false) or harmonic (true) form. */
  isHarmonic: boolean;
  /** Direction of travel: 1 = ascending, -1 = descending. */
  dir: 1 | -1;
  /** The correct multiple-choice answer (identical to `interval`). */
  correctAnswer: CatalogInterval;
}

/**
 * The result of a generation attempt: either a validated question, or a
 * discriminated failure reason. `generateQuestion` never throws.
 */
export type GenerateResult =
  | { ok: true; question: IntervalQuestion }
  | { ok: false; reason: 'empty-selection' | 'no-placeable-interval' };

// ============================================================
// Spelling
// ============================================================

/** Letter names in diatonic order. */
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

/** Letter → its index within an octave (C = 0 … B = 6). */
const LETTER_INDEX: Record<string, number> = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6,
};

/** Letter → its natural semitone offset within an octave. */
const LETTER_SEMITONES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** White-key MIDI pitch class → letter name. */
const PITCH_CLASS_TO_LETTER: Record<number, string> = {
  0: 'C',
  2: 'D',
  4: 'E',
  5: 'F',
  7: 'G',
  9: 'A',
  11: 'B',
};

/** Build an accidental string from a semitone difference, or null if |diff| > 2. */
function accidentalForDiff(diff: number): string | null {
  if (diff > 2 || diff < -2) return null;
  if (diff === 0) return '';
  return diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff);
}

/**
 * Spell the reference and target notes of an interval.
 *
 * Given a white-key reference MIDI, a catalog interval, and a direction of
 * travel, this:
 *
 * 1. counts `interval.number` diatonic letter-steps from the reference letter
 *    in the direction of travel (Requirement 9.1, 9.4) — `number` is inclusive,
 *    so a unison (1) is the same letter and an octave (8) is seven letter-steps
 *    away;
 * 2. computes the actual target MIDI as `refMidi + dir * interval.semitones`;
 * 3. chooses the accidental that makes the target letter sound at that MIDI, so
 *    the spelled semitone distance equals `interval.semitones` (Requirement 9.2,
 *    9.3, 9.5) — this honors the specific chosen quality and keeps enharmonic
 *    partners (e.g. A4 spelled F→B vs d5 spelled F→C♭) distinct;
 * 4. returns `null` when the required accidental would exceed a double-sharp or
 *    double-flat (Requirement 9.6).
 *
 * The reference note is always a white key, so `refPitch` carries no accidental.
 *
 * @param refMidi white-key reference MIDI note number
 * @param interval the target catalog interval
 * @param dir 1 = ascending, -1 = descending
 * @returns spelled `{ refPitch, targetPitch }`, or `null` if unspellable within ±2 accidentals
 */
export function spellInterval(
  refMidi: number,
  interval: CatalogInterval,
  dir: 1 | -1,
): { refPitch: string; targetPitch: string } | null {
  const refPitchClass = ((refMidi % 12) + 12) % 12;
  const refLetter = PITCH_CLASS_TO_LETTER[refPitchClass];
  if (refLetter === undefined) {
    // Reference is not a white key; caller contract violated.
    return null;
  }

  const refOctave = Math.floor(refMidi / 12) - 1;
  const refDiatonicStep = LETTER_INDEX[refLetter] + refOctave * 7;

  // Inclusive number → count (number - 1) letter-steps in the travel direction.
  const targetDiatonicStep = refDiatonicStep + dir * (interval.number - 1);
  const targetLetterIdx = ((targetDiatonicStep % 7) + 7) % 7;
  const targetOctave = Math.floor(targetDiatonicStep / 7);
  const targetLetter = LETTERS[targetLetterIdx];

  const naturalTargetMidi =
    LETTER_SEMITONES[targetLetter] + (targetOctave + 1) * 12;
  const actualTargetMidi = refMidi + dir * interval.semitones;
  const diff = actualTargetMidi - naturalTargetMidi;

  const accidental = accidentalForDiff(diff);
  if (accidental === null) return null;

  return {
    refPitch: `${refLetter}${refOctave}`,
    targetPitch: `${targetLetter}${accidental}${targetOctave}`,
  };
}

// ============================================================
// Dual-validation guard (verifySpelling / validateQuestion)
// ============================================================

/** Matches a spelled pitch: letter, optional (double) accidental, octave. */
const PITCH_PATTERN = /^([A-G])(#{1,2}|b{1,2})?(-?\d+)$/;

/** Accidental string → semitone offset. */
const ACCIDENTAL_OFFSET: Record<string, number> = {
  '': 0,
  '#': 1,
  '##': 2,
  b: -1,
  bb: -2,
};

/**
 * A parsed pitch string, exposing the two facts the dual-validation checks
 * need: its diatonic letter position (for inclusive letter-name distance) and
 * its MIDI value (for semitone distance).
 */
interface ParsedPitch {
  /** Absolute diatonic step: LETTER_INDEX + octave * 7 (letters only). */
  diatonicStep: number;
  /** MIDI note number, accounting for the accidental. */
  midi: number;
}

/**
 * Parse a spelled pitch string like "F#4", "Cb5", or "F##3" into its diatonic
 * step and MIDI value. Returns `null` for anything that is not a valid pitch
 * (unknown letter, malformed accidental, missing octave).
 */
function parsePitch(pitch: string): ParsedPitch | null {
  const match = PITCH_PATTERN.exec(pitch);
  if (match === null) return null;

  const letter = match[1];
  const accidental = match[2] ?? '';
  const octave = Number.parseInt(match[3], 10);

  const letterIndex = LETTER_INDEX[letter];
  const naturalSemitone = LETTER_SEMITONES[letter];
  if (letterIndex === undefined || naturalSemitone === undefined) return null;

  const offset = ACCIDENTAL_OFFSET[accidental];
  if (offset === undefined) return null;

  return {
    diatonicStep: letterIndex + octave * 7,
    midi: naturalSemitone + offset + (octave + 1) * 12,
  };
}

/**
 * Verify that two spelled notes correctly realize a target interval, using two
 * INDEPENDENT checks. Returns `true` only when BOTH pass (Requirement 9.1–9.4):
 *
 * - **Check A (letter/number):** the two spelled notes span exactly
 *   `interval.number` in INCLUSIVE letter-name distance — counting letter names
 *   only, so accidentals never change the number. (e.g. F→B is a 4th; F→C is a
 *   5th, regardless of accidentals.)
 * - **Check B (semitone/quality):** the semitone distance between the two notes
 *   equals `interval.semitones`.
 *
 * Worked examples for target P4 (4th, 5 semitones):
 * - `F#4 → B4` passes: F-G-A-B span a 4th (Check A ✓) and the distance is 5
 *   semitones (Check B ✓).
 * - `F#4 → C5` is rejected: F-G-A-B-C span a 5th, so Check A fails.
 *
 * Unparseable pitches fail the check (return `false`).
 *
 * @param refPitch the reference spelled note, e.g. "F#4"
 * @param targetPitch the target spelled note, e.g. "B4"
 * @param interval the target catalog interval
 */
export function verifySpelling(
  refPitch: string,
  targetPitch: string,
  interval: CatalogInterval,
): boolean {
  const ref = parsePitch(refPitch);
  const target = parsePitch(targetPitch);
  if (ref === null || target === null) return false;

  // Check A — inclusive letter-name distance (letters only, ignore accidentals).
  const letterDistance = Math.abs(target.diatonicStep - ref.diatonicStep) + 1;
  const checkA = letterDistance === interval.number;

  // Check B — semitone distance equals the interval's catalog semitone count.
  const semitoneDistance = Math.abs(target.midi - ref.midi);
  const checkB = semitoneDistance === interval.semitones;

  return checkA && checkB;
}

/**
 * Defensive dual-validation guard for a fully-assembled question. Runs both
 * independent checks (see {@link verifySpelling}) over the question's spelled
 * notes (`startPitch` / `endPitch`) against its target interval, and returns
 * `true` only when BOTH pass (Requirement 9.1–9.4).
 *
 * `generateQuestion` runs this on every candidate placement and never returns a
 * question for which it returns `false`, hard-guaranteeing the letter-name and
 * semitone invariants against any future spelling regression.
 */
export function validateQuestion(question: IntervalQuestion): boolean {
  return verifySpelling(
    question.startPitch,
    question.endPitch,
    question.interval,
  );
}

// ============================================================
// Question generation
// ============================================================

/** Lowest playable reference/target MIDI: C2. */
const C2_MIDI = 36;
/** Highest playable reference/target MIDI: C7. */
const C7_MIDI = 96;

/**
 * Clef pitch windows (reusing the constants from the legacy
 * `IntervalPractice.tsx` clef-range helpers). A randomly chosen `treble` clef
 * requires the lower note to sit at or above G3, and a `bass` clef requires the
 * higher note to sit at or below F4, so the assembled pair falls in a sensible
 * window for the drawn clef.
 */
const G3_MIDI = 55;
const F4_MIDI = 65;

/** White-key pitch classes within an octave (C D E F G A B). */
const WHITE_KEY_PITCH_CLASSES = new Set([0, 2, 4, 5, 7, 9, 11]);

/** Bounded number of attribute (direction/clef/form) draws before giving up. */
const MAX_ATTRIBUTE_DRAWS = 24;

/** True iff `midi` names a white key (a valid placement reference note). */
function isWhiteKeyMidi(midi: number): boolean {
  return WHITE_KEY_PITCH_CLASSES.has(((midi % 12) + 12) % 12);
}

/** Return the MIDI of a spelled pitch, or null if it cannot be parsed. */
function midiOfSpelledPitch(pitch: string): number | null {
  const parsed = parsePitch(pitch);
  return parsed === null ? null : parsed.midi;
}

/**
 * True iff a low/high MIDI pair fits the drawn clef's pitch window:
 * treble → the lower note is at or above G3; bass → the higher note is at or
 * below F4.
 */
function fitsClefWindow(
  lowMidi: number,
  highMidi: number,
  clef: 'treble' | 'bass',
): boolean {
  return clef === 'treble' ? lowMidi >= G3_MIDI : highMidi <= F4_MIDI;
}

/** Pick a random array index using the supplied rng. */
function randomIndex(length: number, rng: () => number): number {
  return Math.floor(rng() * length);
}

/**
 * Return a shuffled copy of `items` using a Fisher–Yates shuffle driven by
 * `rng`. The input array is never mutated.
 */
function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** A single valid placement of an interval: reference MIDI + spelled notes. */
interface Placement {
  refMidi: number;
  targetMidi: number;
  refPitch: string;
  targetPitch: string;
}

/**
 * Enumerate every valid placement of `interval` in direction `dir` for the
 * drawn `clef`. A placement is valid when:
 *
 * - the reference is a white-key MIDI in C2–C7 (Requirement 8.5);
 * - `spellInterval` succeeds, i.e. neither note needs more than ±2 accidentals
 *   (Requirement 9.6);
 * - both spelled notes' MIDI values stay within C2–C7 (Requirement 8.5);
 * - the resulting low/high pair fits the drawn clef's pitch window.
 */
function enumeratePlacements(
  interval: CatalogInterval,
  dir: 1 | -1,
  clef: 'treble' | 'bass',
): Placement[] {
  const placements: Placement[] = [];

  for (let refMidi = C2_MIDI; refMidi <= C7_MIDI; refMidi += 1) {
    if (!isWhiteKeyMidi(refMidi)) continue;

    const targetMidi = refMidi + dir * interval.semitones;
    if (targetMidi < C2_MIDI || targetMidi > C7_MIDI) continue;

    const spelled = spellInterval(refMidi, interval, dir);
    if (spelled === null) continue;

    // Defensive: confirm the spelled notes land on the expected MIDI values and
    // inside the playable range (spellInterval already guarantees this, but the
    // range check keeps placement selection self-contained).
    const refSpelledMidi = midiOfSpelledPitch(spelled.refPitch);
    const targetSpelledMidi = midiOfSpelledPitch(spelled.targetPitch);
    if (refSpelledMidi === null || targetSpelledMidi === null) continue;
    if (targetSpelledMidi < C2_MIDI || targetSpelledMidi > C7_MIDI) continue;

    const lowMidi = Math.min(refMidi, targetMidi);
    const highMidi = Math.max(refMidi, targetMidi);
    if (!fitsClefWindow(lowMidi, highMidi, clef)) continue;

    placements.push({
      refMidi,
      targetMidi,
      refPitch: spelled.refPitch,
      targetPitch: spelled.targetPitch,
    });
  }

  return placements;
}

/**
 * Assemble a fully-specified {@link IntervalQuestion} from a chosen interval,
 * placement, and drawn attributes. The reference note is always the starting
 * note; the target is the ending note.
 */
function assembleQuestion(
  interval: CatalogInterval,
  placement: Placement,
  clef: 'treble' | 'bass',
  isHarmonic: boolean,
  dir: 1 | -1,
): IntervalQuestion {
  const { refMidi, targetMidi, refPitch, targetPitch } = placement;

  const startMidi = refMidi;
  const endMidi = targetMidi;
  const lowMidi = Math.min(startMidi, endMidi);
  const highMidi = Math.max(startMidi, endMidi);

  const lowPitch = lowMidi === startMidi ? refPitch : targetPitch;
  const highPitch = highMidi === startMidi ? refPitch : targetPitch;

  return {
    interval,
    startPitch: refPitch,
    endPitch: targetPitch,
    startMidi,
    endMidi,
    lowPitch,
    highPitch,
    lowMidi,
    highMidi,
    semitoneDistance: Math.abs(highMidi - lowMidi),
    clef,
    isHarmonic,
    dir,
    correctAnswer: interval,
  };
}

/**
 * Generate a validated, enharmonic-correct interval question drawn from the
 * learner's selected `subset`.
 *
 * Algorithm (design "Interval generator → generateQuestion algorithm"):
 *
 * 1. Empty subset → `{ ok: false, reason: 'empty-selection' }` (Requirement 8.7).
 * 2. Over a bounded number of attribute draws, randomly pick `dir`, `clef`, and
 *    `isHarmonic` (the `Automatic_Attributes`, Requirement 8.3), then shuffle
 *    the subset members (Requirement 8.4).
 * 3. For each candidate interval, enumerate valid placements — a white-key
 *    reference MIDI in C2–C7 such that both spelled notes stay within C2–C7,
 *    the clef window fits, and spelling stays within ±2 accidentals
 *    (Requirements 8.1, 8.2, 8.5, 9.6). The first candidate with a non-empty
 *    placement set is used; a random placement from it is chosen.
 * 4. The assembled candidate is run through {@link validateQuestion}; if either
 *    dual-validation check fails the placement is rejected and the search
 *    continues (never returns an unvalidated question).
 * 5. A member unplaceable for one direction/clef can still be used under a
 *    different draw thanks to the bounded attribute-draw retry. If no member is
 *    ever placeable, returns `{ ok: false, reason: 'no-placeable-interval' }`
 *    (Requirement 8.6).
 *
 * `generateQuestion` never throws.
 *
 * @param subset the learner's selected catalog IDs
 * @param rng random source in [0, 1); defaults to `Math.random`
 */
export function generateQuestion(
  subset: Subset,
  rng: () => number = Math.random,
): GenerateResult {
  if (subset.size === 0) {
    return { ok: false, reason: 'empty-selection' };
  }

  const members: CatalogInterval[] = [];
  for (const id of subset) {
    const entry = CATALOG_BY_ID.get(id);
    if (entry !== undefined) members.push(entry);
  }
  if (members.length === 0) {
    return { ok: false, reason: 'empty-selection' };
  }

  for (let attempt = 0; attempt < MAX_ATTRIBUTE_DRAWS; attempt += 1) {
    const dir: 1 | -1 = rng() < 0.5 ? 1 : -1;
    const clef: 'treble' | 'bass' = rng() < 0.5 ? 'treble' : 'bass';
    const isHarmonic = rng() < 0.5;

    const shuffled = shuffle(members, rng);

    for (const interval of shuffled) {
      const placements = enumeratePlacements(interval, dir, clef);
      if (placements.length === 0) continue;

      const placement = placements[randomIndex(placements.length, rng)];
      const question = assembleQuestion(
        interval,
        placement,
        clef,
        isHarmonic,
        dir,
      );

      // Defensive dual-validation guard: never return an unvalidated question.
      if (!validateQuestion(question)) continue;

      return { ok: true, question };
    }
  }

  return { ok: false, reason: 'no-placeable-interval' };
}
