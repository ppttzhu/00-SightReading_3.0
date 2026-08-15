/**
 * Multiple-choice option generation for chord practice.
 *
 * `buildOptions` assembles the answer choices for a question: the correct chord
 * type plus distractors, all rendered through the shared `displayLabel` format.
 * Distractors are drawn only from the learner's selection (excluding the
 * correct answer) so the choices stay within the practiced scope. When four or
 * more types are enabled the result is exactly four distinct labels; when fewer
 * than four are enabled it is one label per enabled type. This module is pure
 * and framework-free, mirroring `src/core/theory/intervalOptions.ts`.
 */

import {
  CHORD_CATALOG,
  CATALOG_BY_ID,
  displayLabel,
  type ChordType,
} from './chordCatalog';
import type { SelectedChordTypes } from './chordSelection';

/** Canonical order index of each chord id, for stable option ordering. */
const CATALOG_ORDER = new Map<string, number>(
  CHORD_CATALOG.map((entry, i) => [entry.id, i]),
);

/** Total number of options to present when the selection is large enough. */
const OPTION_COUNT = 4;

/**
 * Fisher–Yates shuffle producing a new array. Uses the supplied `rng` (a
 * function returning a float in `[0, 1)`) so callers/tests can drive the
 * ordering deterministically. Mirrors `intervalOptions.shuffle`.
 */
function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Build the multiple-choice option labels for a question (Requirement 9).
 *
 * Algorithm:
 * 1. Resolve the selection ids to catalog entries, excluding the correct
 *    answer, forming the distractor pool (9.2).
 * 2. Start the options with `correct` (always included, 9.1); fill remaining
 *    slots (up to four total) from a shuffled distractor pool (9.4, 9.5).
 * 3. When fewer than four types are enabled, the pool cannot fill four slots,
 *    so the result is one label per enabled type (9.6).
 * 4. Shuffle the assembled options and map through `displayLabel` (9.3). All
 *    labels are distinct because each catalog id contributes at most once and
 *    ids are unique.
 *
 * @param correct   The correct chord type (included once among the options).
 * @param selection The learner's selected scope; the only distractor source.
 * @param rng       Randomness source in `[0, 1)`; defaults to `Math.random`.
 */
export function buildOptions(
  correct: ChordType,
  selection: SelectedChordTypes,
  rng: () => number = Math.random,
): string[] {
  // Step 1: resolve the selection ids to catalog entries, excluding correct.
  const distractorPool: ChordType[] = [];
  for (const id of selection) {
    if (id === correct.id) {
      continue;
    }
    const entry = CATALOG_BY_ID.get(id);
    if (entry) {
      distractorPool.push(entry);
    }
  }

  // Step 2: always include correct, then fill remaining slots from the pool.
  // The pool is shuffled only to decide *which* distractors are picked when the
  // selection has more than four types.
  const chosen: ChordType[] = [correct];
  const shuffledPool = shuffle(distractorPool, rng);
  for (const entry of shuffledPool) {
    if (chosen.length >= OPTION_COUNT) {
      break;
    }
    chosen.push(entry);
  }

  // Step 4: present options in a FIXED order (canonical catalog order) so the
  // answer buttons never reshuffle between questions, then render via displayLabel.
  return chosen
    .sort((a, b) => (CATALOG_ORDER.get(a.id) ?? 0) - (CATALOG_ORDER.get(b.id) ?? 0))
    .map(displayLabel);
}
