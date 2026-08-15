import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SCOPE_PARAM, encodeScope, decodeScope } from './chordScopeSerializer';
import { CHORD_CATALOG } from './chordCatalog';
import { DEFAULT_SELECTION, type SelectedChordTypes } from './chordSelection';

/** All catalog ids, in canonical order. */
const ALL_IDS = CHORD_CATALOG.map((e) => e.id);

/** An arbitrary selection drawn from the catalog ids. */
const selectionArb = (): fc.Arbitrary<SelectedChordTypes> =>
  fc.subarray(ALL_IDS).map((ids) => new Set(ids));

/** A token that is usually a valid catalog id, occasionally an unknown string. */
const tokenArb = (): fc.Arbitrary<string> =>
  fc.oneof(fc.constantFrom(...ALL_IDS), fc.string());

/** Build a URLSearchParams carrying `scope=value`. */
const paramsWithScope = (value: string): URLSearchParams =>
  new URLSearchParams([[SCOPE_PARAM, value]]);

// ---------------------------------------------------------------------------
// Task 3.2 — Property 5
// ---------------------------------------------------------------------------

// Feature: chord-random-scope-selection, Property 5: For any selection,
// encodeScope returns the selected ids — and only those — emitted in canonical
// catalog order.
// Validates: Requirements 5.2
describe('Property 5: Scope encoding uses canonical order', () => {
  it('emits exactly the selected ids in canonical CHORD_CATALOG order', () => {
    fc.assert(
      fc.property(selectionArb(), (selection) => {
        const encoded = encodeScope(selection);
        const tokens = encoded === '' ? [] : encoded.split(',');

        // The emitted tokens are exactly the canonical-order ids present.
        const expected = ALL_IDS.filter((id) => selection.has(id));
        expect(tokens).toEqual(expected);

        // Only selected ids appear, and each selected id appears once.
        expect(new Set(tokens)).toEqual(new Set(selection));
        expect(tokens.length).toBe(selection.size);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Task 3.3 — Property 6
// ---------------------------------------------------------------------------

// Feature: chord-random-scope-selection, Property 6: For any selection,
// decoding the query string produced by encodeScope yields a selection equal
// to the original.
// Validates: Requirements 5.3
describe('Property 6: Scope serialization round-trip', () => {
  it('decode(encode(selection)) equals the original selection', () => {
    fc.assert(
      fc.property(selectionArb(), (selection) => {
        const decoded = decodeScope(paramsWithScope(encodeScope(selection)));

        // A non-empty selection round-trips exactly. An empty selection encodes
        // to '' which decodes to DEFAULT_SELECTION (the documented fallback), so
        // the round-trip identity holds precisely for non-empty selections.
        if (selection.size > 0) {
          expect(new Set(decoded)).toEqual(new Set(selection));
        } else {
          expect(new Set(decoded)).toEqual(new Set(DEFAULT_SELECTION));
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Task 3.4 — Property 7
// ---------------------------------------------------------------------------

// Feature: chord-random-scope-selection, Property 7: For any token list mixing
// valid catalog ids (possibly repeated) with invalid tokens, decodeScope
// returns exactly the set of distinct valid ids present; and for any string
// containing no valid catalog id (including empty), as well as an absent
// parameter, decodeScope returns the default selection {maj, min, aug}.
// Validates: Requirements 5.4, 5.5, 5.6
describe('Property 7: Decoding is robust and defaults safely', () => {
  it('keeps distinct valid ids and drops invalid/duplicate tokens', () => {
    fc.assert(
      fc.property(
        fc.array(tokenArb(), { maxLength: 20 }),
        (tokens) => {
          const decoded = decodeScope(paramsWithScope(tokens.join(',')));

          // The set of valid, distinct catalog ids among the tokens.
          const validIds = new Set(
            tokens.map((t) => t.trim()).filter((t) => ALL_IDS.includes(t)),
          );

          if (validIds.size > 0) {
            expect(new Set(decoded)).toEqual(validIds);
          } else {
            // No valid id present → default selection.
            expect(new Set(decoded)).toEqual(new Set(DEFAULT_SELECTION));
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns the default selection for any string with no valid id', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.split(',').some((t) => ALL_IDS.includes(t.trim()))),
        (noise) => {
          const decoded = decodeScope(paramsWithScope(noise));
          expect(new Set(decoded)).toEqual(new Set(DEFAULT_SELECTION));
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns the default selection when the scope parameter is absent', () => {
    expect(new Set(decodeScope(new URLSearchParams()))).toEqual(
      new Set(DEFAULT_SELECTION),
    );
  });
});
