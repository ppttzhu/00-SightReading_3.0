/**
 * Multiple-choice option generation for interval practice.
 *
 * `buildOptions` assembles the four answer choices for a question: the correct
 * interval plus three distractors, all rendered through the shared
 * `displayName` format. Distractors are drawn from the learner's selected
 * subset first (so the choices stay within the practiced scope), preferring a
 * same-`number` sibling to make the question discriminating, and fall back to
 * the full catalog only when the subset cannot supply enough distinct options.
 * This module is pure and framework-free.
 */

import {
  INTERVAL_CATALOG,
  CATALOG_BY_ID,
  displayName,
  type CatalogInterval,
} from './intervalCatalog';
import type { Subset } from './intervalSelection';

/** Number of distractors accompanying the correct answer. */
const DISTRACTOR_COUNT = 3;

/**
 * Fisher–Yates shuffle producing a new array. Uses the supplied `rng` (a
 * function returning a float in `[0, 1)`) so callers/tests can drive the
 * ordering deterministically.
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
 * Build the four multiple-choice options for a question (Requirement 10).
 *
 * Algorithm:
 * 1. Start the distractor pool from the subset, excluding the correct answer.
 * 2. If the subset contains a same-`number` sibling of the correct answer,
 *    force one such sibling into the distractors first (10.4).
 * 3. Fill remaining distractor slots from the subset pool; if fewer than three
 *    subset distractors exist, fall back to catalog entries not already chosen
 *    (10.3, 10.5).
 * 4. Return `[correct, ...3 distractors]` mapped through `displayName`,
 *    shuffled, guaranteed to be exactly four mutually distinct display names
 *    with the correct answer included exactly once (10.1, 10.2, 10.6).
 *
 * @param correct The correct interval (included once among the options).
 * @param subset  The learner's selected scope; the primary distractor source.
 * @param rng     Randomness source in `[0, 1)`; defaults to `Math.random`.
 */
export function buildOptions(
  correct: CatalogInterval,
  subset: Subset,
  rng: () => number = Math.random,
): string[] {
  // Resolve the subset ids to catalog entries, excluding the correct answer.
  const subsetPool: CatalogInterval[] = [];
  for (const id of subset) {
    if (id === correct.id) {
      continue;
    }
    const entry = CATALOG_BY_ID.get(id);
    if (entry) {
      subsetPool.push(entry);
    }
  }

  const distractors: CatalogInterval[] = [];
  const chosenIds = new Set<string>([correct.id]);

  // Step 2: force one same-number sibling from the subset first, if present.
  const shuffledSubset = shuffle(subsetPool, rng);
  const sibling = shuffledSubset.find(
    (entry) => entry.number === correct.number,
  );
  if (sibling) {
    distractors.push(sibling);
    chosenIds.add(sibling.id);
  }

  // Step 3a: fill remaining slots from the subset pool.
  for (const entry of shuffledSubset) {
    if (distractors.length >= DISTRACTOR_COUNT) {
      break;
    }
    if (!chosenIds.has(entry.id)) {
      distractors.push(entry);
      chosenIds.add(entry.id);
    }
  }

  // Step 3b: fall back to catalog entries not already chosen.
  if (distractors.length < DISTRACTOR_COUNT) {
    const catalogFallback = shuffle(INTERVAL_CATALOG, rng);
    for (const entry of catalogFallback) {
      if (distractors.length >= DISTRACTOR_COUNT) {
        break;
      }
      if (!chosenIds.has(entry.id)) {
        distractors.push(entry);
        chosenIds.add(entry.id);
      }
    }
  }

  // Step 4: assemble, map through displayName, and shuffle.
  const options = [correct, ...distractors];
  return shuffle(options, rng).map(displayName);
}
