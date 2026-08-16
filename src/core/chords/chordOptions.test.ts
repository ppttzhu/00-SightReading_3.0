import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildOptions } from './chordOptions';
import { CHORD_CATALOG, CATALOG_BY_ID } from './chordCatalog';
import type { SelectedChordTypes } from './chordSelection';

/** All catalog ids, used to build arbitrary selections. */
const ALL_IDS = CHORD_CATALOG.map((e) => e.id);

/** The set of every uiLabel in the catalog. */
const ALL_LABELS = new Set(CHORD_CATALOG.map((e) => e.uiLabel));

/**
 * An arbitrary non-empty selection paired with a `correct` id drawn from that
 * same selection. Generating the selection first and then picking `correct`
 * from it guarantees the property's precondition (correct is in scope).
 */
const selectionWithCorrectArb = (): fc.Arbitrary<{
  selection: SelectedChordTypes;
  correctId: string;
}> =>
  fc
    .subarray(ALL_IDS, { minLength: 1 })
    .chain((ids) =>
      fc.constantFrom(...ids).map((correctId) => ({
        selection: new Set(ids) as SelectedChordTypes,
        correctId,
      })),
    );

/** A deterministic rng driven by a fast-check seed for reproducible shuffles. */
const rngArb = (): fc.Arbitrary<() => number> =>
  fc.integer({ min: 1, max: 0x7fffffff }).map((seed) => {
    let state = seed;
    return () => {
      // xorshift32 → float in [0, 1)
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return ((state >>> 0) % 1_000_000) / 1_000_000;
    };
  });

// ---------------------------------------------------------------------------
// Task 5.2 — Property 12
// ---------------------------------------------------------------------------

// Feature: chord-random-scope-selection, Property 12: For any selection and any
// correct chord type drawn from that selection, the options returned by
// buildOptions include the correct type's uiLabel, contain only labels of types
// in the selection, are all distinct, and have length exactly four when the
// selection has four or more types or exactly the selection size when it has
// fewer than four.
// Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
describe('Property 12: Options are well-formed', () => {
  it('includes correct, stays in scope, is distinct, and is correctly sized', () => {
    fc.assert(
      fc.property(
        selectionWithCorrectArb(),
        rngArb(),
        ({ selection, correctId }, rng) => {
          const correct = CATALOG_BY_ID.get(correctId)!;
          const options = buildOptions(correct, selection, rng);

          // 9.1 — the correct type's uiLabel is present.
          expect(options).toContain(correct.uiLabel);

          // 9.2 — every label belongs to a type in the selection.
          const selectionLabels = new Set(
            [...selection].map((id) => CATALOG_BY_ID.get(id)!.uiLabel),
          );
          for (const label of options) {
            expect(ALL_LABELS.has(label)).toBe(true);
            expect(selectionLabels.has(label)).toBe(true);
          }

          // 9.3 — all labels are distinct.
          expect(new Set(options).size).toBe(options.length);

          // 9.4, 9.5, 9.6 — length is four when >=4 types, else selection size.
          const expectedLength = selection.size >= 4 ? 4 : selection.size;
          expect(options.length).toBe(expectedLength);
        },
      ),
      { numRuns: 100 },
    );
  });
});
