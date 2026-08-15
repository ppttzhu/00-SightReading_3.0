/**
 * Chord question generation, enharmonic-correct spelling, and structural
 * validation.
 *
 * This module is pure and framework-free. It builds on the canonical
 * `chordCatalog` to spell, validate, and generate single-chord questions for
 * the chord-identification practice screen. It mirrors the module boundaries
 * and purity discipline of `src/core/theory/intervalGenerator.ts`.
 *
 * Every chord is voiced in root position, close position (stacked thirds), and
 * is spelled with enharmonic-correct letter-plus-accidental pitch strings — the
 * spelled pitch strings, not the MIDI numbers, are the source of truth for note
 * names (a C diminished 7th's seventh is `Bbb`, not `A`).
 */

import type { ChordType } from './chordCatalog';
import { CATALOG_BY_ID } from './chordCatalog';
import type { SelectedChordTypes } from './chordSelection';

// ============================================================
// Types
// ============================================================

/**
 * A fully-specified chord question. Every fact needed to name, render, play,
 * and grade the question is stored explicitly. The spelled `pitches` are the
 * source of truth for note names; `midis` are derived and kept parallel.
 */
export interface ChordQuestion {
  /** The chord type identity (also the correct answer). */
  chordType: ChordType;
  /** Spelled tones low→high, root first, e.g. ["C4","Eb4","Gb4","Bbb4"]. */
  pitches: string[];
  /** MIDI values parallel to `pitches`, strictly ascending. */
  midis: number[];
  /** Spelled example tones for the chosen root (letters + accidentals). */
  example: string[];
  /** The correct multiple-choice answer (== chordType). */
  correctAnswer: ChordType;
}

/**
 * The result of a generation attempt: either a validated question, or a
 * discriminated failure reason. `generateQuestion` never throws.
 */
export type GenerateResult =
  | { ok: true; question: ChordQuestion }
  | { ok: false; reason: 'empty-selection' | 'no-placeable-chord' };

// ============================================================
// Letter / semitone / accidental helpers
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

/** Build an accidental string from a semitone difference, or null if |diff| > 2. */
function accidentalForDiff(diff: number): string | null {
  if (diff > 2 || diff < -2) return null;
  if (diff === 0) return '';
  return diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff);
}

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
 * A parsed pitch string, exposing the two facts validation needs: its diatonic
 * letter position (for letter-stacking checks) and its MIDI value (for the
 * semitone checks).
 */
interface ParsedPitch {
  /** Absolute diatonic step: LETTER_INDEX + octave * 7 (letters only). */
  diatonicStep: number;
  /** MIDI note number, accounting for the accidental. */
  midi: number;
}

/**
 * Parse a spelled pitch string like "C4", "Eb4", or "Bbb3" into its diatonic
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

/** Strip the octave (and optional sign) off a spelled pitch, leaving letter + accidental. */
function stripOctave(pitch: string): string {
  const match = PITCH_PATTERN.exec(pitch);
  if (match === null) return pitch;
  return `${match[1]}${match[2] ?? ''}`;
}

// ============================================================
// Spelling
// ============================================================

/**
 * Spell a chord's tones from a spelled root using strict stacked thirds
 * (Requirement 7).
 *
 * 1. Parse `rootSpelled` into `{ letter, accidental, octave }` →
 *    `rootMidi` and `rootDiatonicStep = LETTER_INDEX[letter] + octave * 7`.
 * 2. For each tone index `i`:
 *    - `diatonicStep = rootDiatonicStep + 2 * i` (stacked thirds: skip one
 *      letter name between adjacent tones, 7.1).
 *    - choose the accidental making the tone sound at
 *      `rootMidi + semitonesFromRoot[i]` (7.2); return `null` when it would need
 *      more than a double sharp / double flat (7.4).
 * 3. Return `pitches` (letter + accidental + octave, low→high) and `midis`.
 *
 * Because Dim7's seventh sits on the root letter + 6 letter-steps (e.g. `B`
 * above `C`) whose natural is 11 semitones while the target is 9, `diff = -2`
 * → `bb`, producing `Bbb` (7.3).
 *
 * @param rootSpelled the spelled root, e.g. "C4"
 * @param chordType the chord type to spell
 * @returns `{ pitches, midis }`, or `null` if unspellable within ±2 accidentals
 */
export function spellChord(
  rootSpelled: string,
  chordType: ChordType,
): { pitches: string[]; midis: number[] } | null {
  const root = parsePitch(rootSpelled);
  if (root === null) return null;

  const rootMidi = root.midi;
  const rootDiatonicStep = root.diatonicStep;

  const pitches: string[] = [];
  const midis: number[] = [];

  for (let i = 0; i < chordType.semitonesFromRoot.length; i += 1) {
    const diatonicStep = rootDiatonicStep + 2 * i;
    const letterIdx = ((diatonicStep % 7) + 7) % 7;
    const octave = Math.floor(diatonicStep / 7);
    const letter = LETTERS[letterIdx];

    const naturalMidi = LETTER_SEMITONES[letter] + (octave + 1) * 12;
    const targetMidi = rootMidi + chordType.semitonesFromRoot[i];
    const diff = targetMidi - naturalMidi;

    const accidental = accidentalForDiff(diff);
    if (accidental === null) return null;

    pitches.push(`${letter}${accidental}${octave}`);
    midis.push(targetMidi);
  }

  return { pitches, midis };
}

// ============================================================
// Validation guard
// ============================================================

/**
 * The triple-check validation guard (Requirement 8). Given the spelled
 * `pitches` and the intended `chordType`, parse each pitch and confirm ALL
 * three independent checks:
 *
 * - **Check A — stacked structure (8.1):** successive `midi` differences equal
 *   `chordType.stackedStructure`.
 * - **Check B — semitones from root (8.2):** `midi[i] - midi[0]` equals
 *   `chordType.semitonesFromRoot[i]` for every `i`.
 * - **Check C — letter stacking (8.3):** `diatonicStep[i] - diatonicStep[0]`
 *   equals `2 * i` for every `i` (each tone is two letter names above the
 *   root).
 *
 * Returns `true` only when A ∧ B ∧ C (8.4). Unparseable pitches or a tone-count
 * mismatch fail the guard.
 */
export function validateChord(
  pitches: string[],
  chordType: ChordType,
): boolean {
  // Tone-count must match the chord type.
  if (pitches.length !== chordType.semitonesFromRoot.length) return false;

  const parsed: ParsedPitch[] = [];
  for (const pitch of pitches) {
    const p = parsePitch(pitch);
    if (p === null) return false;
    parsed.push(p);
  }

  // Check A — successive semitone gaps equal the stacked structure.
  const structure = chordType.stackedStructure;
  if (parsed.length - 1 !== structure.length) return false;
  for (let i = 1; i < parsed.length; i += 1) {
    if (parsed[i].midi - parsed[i - 1].midi !== structure[i - 1]) return false;
  }

  // Check B — semitone offsets from the root equal semitonesFromRoot.
  for (let i = 0; i < parsed.length; i += 1) {
    if (parsed[i].midi - parsed[0].midi !== chordType.semitonesFromRoot[i]) {
      return false;
    }
  }

  // Check C — letters are stacked in thirds (two letter names apart each step).
  for (let i = 0; i < parsed.length; i += 1) {
    if (parsed[i].diatonicStep - parsed[0].diatonicStep !== 2 * i) return false;
  }

  return true;
}

// ============================================================
// Question generation
// ============================================================

/** Lowest playable MIDI: C2. */
const C2_MIDI = 36;
/** Highest playable MIDI: C7. */
const C7_MIDI = 96;

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

/**
 * Enumerate every Candidate_Root for `chordType`: a white-key root
 * (C, D, E, F, G, A, B in each octave) whose MIDI lies in C2–C7, for which
 * `spellChord` succeeds AND every resulting tone's MIDI stays within C2–C7.
 * Returns the list of spelled root strings.
 */
function candidateRoots(chordType: ChordType): string[] {
  const roots: string[] = [];

  // White-key roots: octaves spanning the playable range (C1..C7 covers all
  // white keys whose MIDI can land in C2–C7).
  for (let octave = 1; octave <= 7; octave += 1) {
    for (const letter of LETTERS) {
      const rootMidi = LETTER_SEMITONES[letter] + (octave + 1) * 12;
      if (rootMidi < C2_MIDI || rootMidi > C7_MIDI) continue;

      const rootSpelled = `${letter}${octave}`;
      const spelled = spellChord(rootSpelled, chordType);
      if (spelled === null) continue;

      const allInRange = spelled.midis.every(
        (m) => m >= C2_MIDI && m <= C7_MIDI,
      );
      if (!allInRange) continue;

      roots.push(rootSpelled);
    }
  }

  return roots;
}

/**
 * Generate one validated chord question drawn from the learner's `selection`.
 *
 * Algorithm (design "chordGenerator → generateQuestion algorithm"):
 *
 * 1. Empty selection → `{ ok: false, reason: 'empty-selection' }` (6.6).
 * 2. Resolve selection ids to `ChordType` entries, ignoring unknown ids; if
 *    none resolve, treat as empty selection.
 * 3. Shuffle the resolved chord types with `rng`. For each type, enumerate its
 *    Candidate_Roots (white-key roots in C2–C7 that spell within ±2 accidentals
 *    and keep every tone in range, 6.2, 6.5, 7.4). Use the first type with a
 *    non-empty candidate set and pick a random root from it (6.1).
 * 4. Assemble the root-position / close-position question (6.3, 6.4) and run
 *    `validateChord`; only return validated chords (8.5).
 * 5. If no selected type has any Candidate_Root, return
 *    `{ ok: false, reason: 'no-placeable-chord' }` (6.7).
 *
 * `generateQuestion` never throws for any input (6.8).
 *
 * @param selection the learner's selected catalog ids
 * @param rng random source in [0, 1); defaults to `Math.random`
 */
export function generateQuestion(
  selection: SelectedChordTypes,
  rng: () => number = Math.random,
): GenerateResult {
  if (selection.size === 0) {
    return { ok: false, reason: 'empty-selection' };
  }

  const members: ChordType[] = [];
  for (const id of selection) {
    const entry = CATALOG_BY_ID.get(id);
    if (entry !== undefined) members.push(entry);
  }
  if (members.length === 0) {
    return { ok: false, reason: 'empty-selection' };
  }

  const shuffledTypes = shuffle(members, rng);

  for (const chordType of shuffledTypes) {
    const roots = candidateRoots(chordType);
    if (roots.length === 0) continue;

    // Pick a random root, then defensively try the rest if validation fails
    // (with the shipped catalog spelling is always sound, so the first passes).
    const shuffledRoots = shuffle(roots, rng);
    for (const rootSpelled of shuffledRoots) {
      const spelled = spellChord(rootSpelled, chordType);
      if (spelled === null) continue;

      if (!validateChord(spelled.pitches, chordType)) continue;

      const question: ChordQuestion = {
        chordType,
        pitches: spelled.pitches,
        midis: spelled.midis,
        example: spelled.pitches.map(stripOctave),
        correctAnswer: chordType,
      };
      return { ok: true, question };
    }
  }

  return { ok: false, reason: 'no-placeable-chord' };
}
