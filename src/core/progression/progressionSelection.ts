/**
 * The learner's progression selection and its pure editing operations.
 *
 * The scope is modeled as a `SelectedProgressions` — a set of ProgressionId
 * tokens. The setup-page checkboxes edit the set via `toggleProgression`, and
 * the start-practice guard reads `isNonEmpty`. This module is pure and
 * framework-free, mirroring `src/core/chords/chordSelection.ts`.
 */

import type { ProgressionId } from './progressions';

/** The learner's selection: a set of ProgressionId tokens. */
export type SelectedProgressions = ReadonlySet<ProgressionId>;

/**
 * The default scope: all four Level 6 progressions. This is a sensible
 * non-empty starting point so the learner can begin practicing immediately.
 */
export const DEFAULT_SELECTION: SelectedProgressions = new Set<ProgressionId>([
  'maj_sub',
  'maj_dom',
  'min_sub',
  'min_dom',
]);

/**
 * Toggle one progression id on/off. Returns `selection ∪ {id}` when `checked`
 * is true, or `selection \ {id}` when false. The input selection is never
 * mutated — a new set is always returned.
 */
export function toggleProgression(
  selection: SelectedProgressions,
  id: ProgressionId,
  checked: boolean,
): SelectedProgressions {
  const next = new Set(selection);
  if (checked) {
    next.add(id);
  } else {
    next.delete(id);
  }
  return next;
}

/** The start guard: true iff the selection contains at least one progression. */
export function isNonEmpty(selection: SelectedProgressions): boolean {
  return selection.size > 0;
}
