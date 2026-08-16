/**
 * The learner's chord-type selection and its pure editing operations.
 *
 * The scope is modeled as a `SelectedChordTypes` — a set of chord catalog ids.
 * The setup-page chips edit the set directly via `toggleType`, and the
 * start-practice guard reads `isNonEmpty`. This module is pure and
 * framework-free, mirroring `src/core/theory/intervalSelection.ts`.
 */

/** The learner's selection: a set of chord catalog ids. */
export type SelectedChordTypes = ReadonlySet<string>;

/**
 * The default scope: Maj, min, and Dom7. This is a sensible non-empty starting
 * point so the learner can begin practicing immediately.
 */
export const DEFAULT_SELECTION: SelectedChordTypes = new Set([
  'maj',
  'min',
  'dom7',
]);

/**
 * Toggle one id on/off (Requirement 3.3, 3.4). Returns `selection ∪ {id}` when
 * `checked` is true, or `selection \ {id}` when false. The input selection is
 * never mutated — a new set is always returned.
 */
export function toggleType(
  selection: SelectedChordTypes,
  id: string,
  checked: boolean,
): SelectedChordTypes {
  const next = new Set(selection);
  if (checked) {
    next.add(id);
  } else {
    next.delete(id);
  }
  return next;
}

/**
 * The start guard (Requirement 4.2, 4.4): true iff the selection contains at
 * least one member.
 */
export function isNonEmpty(selection: SelectedChordTypes): boolean {
  return selection.size > 0;
}
