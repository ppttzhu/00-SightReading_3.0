import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  DEFAULT_SELECTION,
  toggleType,
  isNonEmpty,
  type SelectedChordTypes,
} from './chordSelection';
import { CHORD_CATALOG } from './chordCatalog';

/** All catalog ids, used to build arbitrary selections. */
const ALL_IDS = CHORD_CATALOG.map((e) => e.id);

/** An arbitrary selection drawn from the catalog ids. */
const selectionArb = (): fc.Arbitrary<SelectedChordTypes> =>
  fc.subarray(ALL_IDS).map((ids) => new Set(ids));

/**
 * An arbitrary id: usually a real catalog id, occasionally an unknown token so
 * the toggle properties cover ids that may or may not already be present.
 */
const idArb = (): fc.Arbitrary<string> =>
  fc.oneof(fc.constantFrom(...ALL_IDS), fc.string());

// ---------------------------------------------------------------------------
// Task 2.2 — Unit test
// ---------------------------------------------------------------------------

describe('DEFAULT_SELECTION (Requirement 4.1)', () => {
  it('equals the set {maj, min, dom7}', () => {
    expect(new Set(DEFAULT_SELECTION)).toEqual(new Set(['maj', 'min', 'dom7']));
    expect(DEFAULT_SELECTION.size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Task 2.3 — Property 3
// ---------------------------------------------------------------------------

// Feature: chord-random-scope-selection, Property 3: For any selection and any
// catalog id, toggleType(selection, id, true) contains id and adds nothing
// else, toggleType(selection, id, false) excludes id and removes nothing else,
// and setting the same checked value twice is idempotent. The input selection
// is never mutated.
// Validates: Requirements 3.3, 3.4
describe('Property 3: Selection toggle add/remove', () => {
  it('holds for any selection and id', () => {
    fc.assert(
      fc.property(selectionArb(), idArb(), (selection, id) => {
        const before = new Set(selection);

        // toggle true: adds id and nothing else.
        const added = toggleType(selection, id, true);
        expect(added.has(id)).toBe(true);
        for (const other of before) {
          expect(added.has(other)).toBe(true);
        }
        for (const member of added) {
          expect(member === id || before.has(member)).toBe(true);
        }

        // toggle false: removes id and nothing else.
        const removed = toggleType(selection, id, false);
        expect(removed.has(id)).toBe(false);
        for (const member of removed) {
          expect(before.has(member)).toBe(true);
        }
        for (const other of before) {
          if (other !== id) {
            expect(removed.has(other)).toBe(true);
          }
        }

        // Setting to a value is idempotent: toggling to the same checked value
        // twice equals toggling once (a set membership is set, not flipped).
        for (const v of [true, false]) {
          const once = toggleType(selection, id, v);
          const twice = toggleType(once, id, v);
          expect(new Set(twice)).toEqual(new Set(once));
        }

        // input is never mutated.
        expect(new Set(selection)).toEqual(before);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Task 2.4 — Property 4
// ---------------------------------------------------------------------------

// Feature: chord-random-scope-selection, Property 4: For any selection,
// isNonEmpty(selection) is true exactly when the selection has at least one
// member.
// Validates: Requirements 4.2, 4.4
describe('Property 4: Non-empty guard', () => {
  it('is true iff the selection size is at least one', () => {
    fc.assert(
      fc.property(selectionArb(), (selection) => {
        expect(isNonEmpty(selection)).toBe(selection.size >= 1);
      }),
      { numRuns: 100 },
    );
  });
});
