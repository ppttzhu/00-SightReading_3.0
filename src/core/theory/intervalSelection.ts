/**
 * Coarse↔fine interval selection synchronization.
 *
 * The learner's scope selection is modeled as a `Subset` — a set of catalog
 * interval IDs. The fine (checkbox) control edits the subset directly; the
 * coarse (dropdown) control is a *lens* over the subset: coarse edits recompute
 * the subset (`coarseToSubset`), and the coarse UI state is *derived* from the
 * subset (`subsetToCoarseNumbers` / `subsetToCoarseQualities`, intentionally
 * lossy per Requirement 5). This module is pure and framework-free.
 */

import {
  INTERVAL_CATALOG,
  type IntervalNumber,
  type IntervalQuality,
} from './intervalCatalog';

/** The learner's selection: a set of catalog interval IDs. */
export type Subset = ReadonlySet<string>;

/**
 * The default selection: the common diatonic intervals — excludes the
 * augmented and diminished qualities and the unison (1st degree). This leaves
 * m2/M2, m3/M3, P4, P5, m6/M6, m7/M7, and P8 selected by default; the learner
 * can add the rarer qualities/unison as needed.
 */
export const DEFAULT_SUBSET: Subset = new Set(
  INTERVAL_CATALOG.filter(
    (entry) =>
      entry.number !== 1 &&
      entry.quality !== 'augmented' &&
      entry.quality !== 'diminished',
  ).map((entry) => entry.id),
);

/**
 * Coarse → subset (Requirement 4.3–4.5).
 *
 * Returns exactly the catalog entries whose `number` is among `numbers` **and**
 * whose `quality` is among `qualities`. Because only catalog rows are
 * considered, impossible `(number, quality)` pairs (e.g. 三度 × 纯) naturally
 * contribute nothing (4.4). An empty `numbers` or empty `qualities` set yields
 * the empty subset (4.5).
 */
export function coarseToSubset(
  numbers: ReadonlySet<IntervalNumber>,
  qualities: ReadonlySet<IntervalQuality>,
): Subset {
  const result = new Set<string>();
  for (const entry of INTERVAL_CATALOG) {
    if (numbers.has(entry.number) && qualities.has(entry.quality)) {
      result.add(entry.id);
    }
  }
  return result;
}

/**
 * Subset → coarse numbers (Requirement 5.2–5.5).
 *
 * Implements the intentionally lossy "all-members-present" rule: a number is
 * included only when **every** catalog member of that number is in the subset.
 */
export function subsetToCoarseNumbers(subset: Subset): Set<IntervalNumber> {
  const membersByNumber = new Map<IntervalNumber, string[]>();
  for (const entry of INTERVAL_CATALOG) {
    const members = membersByNumber.get(entry.number);
    if (members) {
      members.push(entry.id);
    } else {
      membersByNumber.set(entry.number, [entry.id]);
    }
  }

  const result = new Set<IntervalNumber>();
  for (const [number, members] of membersByNumber) {
    if (members.every((id) => subset.has(id))) {
      result.add(number);
    }
  }
  return result;
}

/**
 * Subset → coarse qualities (Requirement 5.2–5.5).
 *
 * Implements the "all-members-present" rule: a quality is included only when
 * **every** catalog member of that quality is in the subset.
 */
export function subsetToCoarseQualities(subset: Subset): Set<IntervalQuality> {
  const membersByQuality = new Map<IntervalQuality, string[]>();
  for (const entry of INTERVAL_CATALOG) {
    const members = membersByQuality.get(entry.quality);
    if (members) {
      members.push(entry.id);
    } else {
      membersByQuality.set(entry.quality, [entry.id]);
    }
  }

  const result = new Set<IntervalQuality>();
  for (const [quality, members] of membersByQuality) {
    if (members.every((id) => subset.has(id))) {
      result.add(quality);
    }
  }
  return result;
}

/**
 * Fine toggle (Requirement 3.5–3.6). Returns `subset ∪ {id}` when `checked` is
 * true, or `subset \ {id}` when false. The input subset is never mutated.
 */
export function toggleInterval(
  subset: Subset,
  id: string,
  checked: boolean,
): Subset {
  const next = new Set(subset);
  if (checked) {
    next.add(id);
  } else {
    next.delete(id);
  }
  return next;
}

/** The start guard (Requirement 6.2/6.4): true iff the subset is non-empty. */
export function isNonEmpty(subset: Subset): boolean {
  return subset.size > 0;
}
