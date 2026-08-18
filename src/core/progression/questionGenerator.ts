/**
 * The Question_Generator for the RCM Level 6 chord-progression exercise.
 *
 * {@link generateQuestion} randomly selects a Mode, Key, and Harmonic_Function,
 * derives the matching supported Progression, resolves its three chords in the
 * chosen Key, and assembles the answer metadata into a
 * {@link ProgressionQuestion}. It is pure and framework-free (no React, VexFlow,
 * or Tone.js imports), mirroring the discipline of the other progression core
 * modules.
 *
 * Randomization is delegated to an injected `rng` source (defaulting to
 * `Math.random`), so the generator is deterministic and reproducible under a
 * seeded rng for property tests. Because all four Progressions and every
 * supported Key are always available and spell within ±2 accidentals in the
 * base octave, the generator NEVER throws and has NO failure variant: it always
 * returns a valid {@link ProgressionQuestion} directly rather than a
 * discriminated union (Requirement 12.3).
 */

import type { KeyName, Mode } from './keys';
import { MAJOR_KEYS, MINOR_KEYS } from './keys';
import type { AnswerChoice, ChordSpec, HarmonicFunction, ProgressionDef } from './progressions';
import { LEVEL6_PROGRESSIONS } from './progressions';
import { DEFAULT_SELECTION, type SelectedProgressions } from './progressionSelection';
import type { ResolvedChord } from './chordResolver';
import { resolveProgression } from './chordResolver';

/**
 * A fully-specified progression question: everything the Presentation_Layer
 * needs to play the Progression and grade an answer.
 */
export interface ProgressionQuestion {
  /** RCM level; fixed at 6 for this exercise. */
  level: 6;
  /** The selected Key, spelled as a letter plus optional accidental. */
  key: KeyName;
  /** The selected Mode. */
  mode: Mode;
  /** The selected Harmonic_Function (functional class of the middle chord). */
  function: HarmonicFunction;
  /** The ordered Chord_Specs (reusable building blocks) of the derived Progression. */
  specs: readonly ChordSpec[];
  /** The three resolved chords, in progression order (root position). */
  chords: ResolvedChord[];
  /** Roman-numeral projection of `specs` (equal to {@link correctAnswer}). */
  progression: AnswerChoice;
  /** The correct Answer_Choice for the derived Progression (Requirement 2.8). */
  correctAnswer: AnswerChoice;
  /** Voicing; fixed to root position at Level 6. */
  inversion: 'root';
  /** Presentation; fixed to blocked (solid) chords at Level 6. */
  presentation: 'blocked';
}

/**
 * Pick one element of a non-empty array using the given random source. The
 * index is `floor(rng() * length)`, so a uniform `rng` in `[0, 1)` yields a
 * uniform choice.
 *
 * @param items a non-empty readonly array
 * @param rng   random source returning a value in `[0, 1)`
 * @returns the chosen element
 */
function pick<T>(items: readonly T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)];
}

/**
 * The Progressions the learner has selected to practice, in canonical order.
 * Falls back to the full set when the selection is empty or names no supported
 * progression, so the generator always has something to produce.
 */
function selectedDefs(selection: SelectedProgressions): ProgressionDef[] {
  const defs = LEVEL6_PROGRESSIONS.filter((p) => selection.has(p.id));
  return defs.length > 0 ? defs : [...LEVEL6_PROGRESSIONS];
}

/**
 * Generate one Level 6 progression question drawn from the learner's
 * `selection`.
 *
 * Steps:
 * 1. Pick a {@link ProgressionDef} from the selected Progressions (Requirement
 *    1.1, 2.3). This determines the Mode and Harmonic_Function together, so the
 *    question is always within the practiced scope.
 * 2. Pick a Key from the pool for that Mode — {@link MAJOR_KEYS} or
 *    {@link MINOR_KEYS} (Requirements 2.2, 6.1, 6.2).
 * 3. `resolveProgression(key, mode, specs)` → three {@link ResolvedChord}s
 *    voiced with the ascending bass line (tonic → middle root above the tonic →
 *    upper tonic, Requirement 15).
 * 4. Assemble the {@link ProgressionQuestion} with answer metadata: the
 *    `progression` and `correctAnswer` are the Progression's `answer`
 *    (Requirement 2.8), voicing is root position, presentation is blocked.
 *
 * Never throws and has no failure variant (Requirement 12.3): an empty/invalid
 * selection falls back to the full set. Deterministic under a seeded `rng`.
 *
 * @param selection the learner's selected Progressions (defaults to all four)
 * @param rng       random source in `[0, 1)`; defaults to `Math.random`
 * @returns a fully-specified Level 6 progression question
 */
export function generateQuestion(
  selection: SelectedProgressions = DEFAULT_SELECTION,
  rng: () => number = Math.random,
): ProgressionQuestion {
  const def = pick(selectedDefs(selection), rng);
  const keyPool = def.mode === 'major' ? MAJOR_KEYS : MINOR_KEYS;
  const key = pick(keyPool, rng);

  // Voice the three chords with the RCM Level 6 ascending bass line (tonic →
  // middle root above the tonic → upper tonic), NOT independent per-chord
  // resolution at a fixed octave.
  const chords = resolveProgression(key, def.mode, def.specs);

  return {
    level: 6,
    key,
    mode: def.mode,
    function: def.function,
    specs: def.specs,
    chords,
    progression: def.answer,
    correctAnswer: def.answer,
    inversion: 'root',
    presentation: 'blocked',
  };
}
