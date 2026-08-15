import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  CHORD_CATALOG,
  CATALOG_BY_ID,
  CATALOG_VALIDATION,
  validateCatalog,
  displayLabel,
  type ChordType,
} from './chordCatalog';

// The canonical design data-table (Requirement "Chord Catalog"). Example shows
// the spelled tones for a root of C.
const EXPECTED_TABLE: ReadonlyArray<{
  id: string;
  uiLabel: string;
  noteCount: number;
  stackedStructure: number[];
  semitonesFromRoot: number[];
  example: string[];
}> = [
  { id: 'maj', uiLabel: 'Maj', noteCount: 3, stackedStructure: [4, 3], semitonesFromRoot: [0, 4, 7], example: ['C', 'E', 'G'] },
  { id: 'min', uiLabel: 'min', noteCount: 3, stackedStructure: [3, 4], semitonesFromRoot: [0, 3, 7], example: ['C', 'Eb', 'G'] },
  { id: 'aug', uiLabel: 'Aug', noteCount: 3, stackedStructure: [4, 4], semitonesFromRoot: [0, 4, 8], example: ['C', 'E', 'G#'] },
  { id: 'maj7', uiLabel: 'Maj7', noteCount: 4, stackedStructure: [4, 3, 4], semitonesFromRoot: [0, 4, 7, 11], example: ['C', 'E', 'G', 'B'] },
  { id: 'min7', uiLabel: 'min7', noteCount: 4, stackedStructure: [3, 4, 3], semitonesFromRoot: [0, 3, 7, 10], example: ['C', 'Eb', 'G', 'Bb'] },
  { id: 'dom7', uiLabel: 'Dom7', noteCount: 4, stackedStructure: [4, 3, 3], semitonesFromRoot: [0, 4, 7, 10], example: ['C', 'E', 'G', 'Bb'] },
  { id: 'dim7', uiLabel: 'Dim7', noteCount: 4, stackedStructure: [3, 3, 3], semitonesFromRoot: [0, 3, 6, 9], example: ['C', 'Eb', 'Gb', 'Bbb'] },
];

// ---------------------------------------------------------------------------
// Task 1.2 — Example / unit tests
// ---------------------------------------------------------------------------

describe('CHORD_CATALOG data-table (Requirements 1.1, 1.2, 1.3)', () => {
  it('contains exactly the seven entries in canonical order', () => {
    expect(CHORD_CATALOG.map((e) => e.id)).toEqual(
      EXPECTED_TABLE.map((e) => e.id),
    );
  });

  it('matches every field of the design data-table', () => {
    EXPECTED_TABLE.forEach((expected, i) => {
      const entry = CHORD_CATALOG[i];
      expect(entry.id).toBe(expected.id);
      expect(entry.uiLabel).toBe(expected.uiLabel);
      expect(entry.noteCount).toBe(expected.noteCount);
      expect([...entry.stackedStructure]).toEqual(expected.stackedStructure);
      expect([...entry.semitonesFromRoot]).toEqual(expected.semitonesFromRoot);
      expect([...entry.example]).toEqual(expected.example);
    });
  });

  it('assigns each entry a unique id (Requirement 1.2)', () => {
    const ids = CHORD_CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('exposes CATALOG_BY_ID as a lookup covering every entry', () => {
    expect(CATALOG_BY_ID.size).toBe(CHORD_CATALOG.length);
    for (const entry of CHORD_CATALOG) {
      expect(CATALOG_BY_ID.get(entry.id)).toBe(entry);
    }
  });

  it('displayLabel returns the entry uiLabel', () => {
    for (const entry of CHORD_CATALOG) {
      expect(displayLabel(entry)).toBe(entry.uiLabel);
    }
  });
});

describe('validateCatalog return shape (Requirement 2.1)', () => {
  it('returns a boolean validity result and a list of error strings', () => {
    const result = validateCatalog(CHORD_CATALOG);
    expect(typeof result.valid).toBe('boolean');
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it('CATALOG_VALIDATION is { valid: true, errors: [] }', () => {
    expect(CATALOG_VALIDATION).toEqual({ valid: true, errors: [] });
  });
});

// ---------------------------------------------------------------------------
// Task 1.3 — Property 1
// ---------------------------------------------------------------------------

// Feature: chord-random-scope-selection, Property 1: For any entry in the chord
// catalog, its semitonesFromRoot begins with 0 and strictly ascends, its
// noteCount equals semitonesFromRoot.length, and the successive differences of
// semitonesFromRoot equal its stackedStructure.
// Validates: Requirements 1.4, 1.5, 1.6
describe('Property 1: Catalog structural invariants', () => {
  it('holds for every catalog entry', () => {
    fc.assert(
      fc.property(fc.constantFrom(...CHORD_CATALOG), (entry: ChordType) => {
        const offsets = entry.semitonesFromRoot;

        // 1.4 — begins with 0 and strictly ascends.
        expect(offsets[0]).toBe(0);
        for (let i = 1; i < offsets.length; i += 1) {
          expect(offsets[i]).toBeGreaterThan(offsets[i - 1]);
        }

        // 1.5 — noteCount equals semitonesFromRoot.length.
        expect(entry.noteCount).toBe(offsets.length);

        // 1.6 — successive differences equal stackedStructure.
        const diffs = offsets.slice(1).map((v, i) => v - offsets[i]);
        expect(diffs).toEqual([...entry.stackedStructure]);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Task 1.4 — Property 2
// ---------------------------------------------------------------------------

/** Deep-clone the canonical catalog into a mutable array of mutable entries. */
function cloneCatalog(): ChordType[] {
  return CHORD_CATALOG.map((e) => ({
    ...e,
    stackedStructure: [...e.stackedStructure],
    semitonesFromRoot: [...e.semitonesFromRoot],
    example: [...e.example],
  }));
}

// Feature: chord-random-scope-selection, Property 2: For any catalog obtained by
// mutating the canonical catalog — changing the entry count away from seven,
// duplicating an id, breaking an entry's noteCount, or breaking an entry's
// stackedStructure/semitonesFromRoot agreement — validateCatalog returns
// valid:false with an error naming the relevant defect; and for the canonical
// (unmutated) catalog it returns valid:true with an empty error list.
// Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6
describe('Property 2: Validation detects malformed catalogs', () => {
  it('accepts the canonical catalog (Requirement 2.6)', () => {
    expect(validateCatalog(CHORD_CATALOG)).toEqual({ valid: true, errors: [] });
  });

  it('rejects a wrong entry count (Requirement 2.2)', () => {
    fc.assert(
      fc.property(
        // How many entries to drop (1..6) — always yields a count other than 7.
        fc.integer({ min: 1, max: 6 }),
        (drop) => {
          const mutated = cloneCatalog().slice(0, 7 - drop);
          const result = validateCatalog(mutated);
          expect(result.valid).toBe(false);
          expect(result.errors.some((e) => e.includes('expected 7'))).toBe(
            true,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects a duplicated id (Requirement 2.3)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 6 }),
        fc.integer({ min: 0, max: 6 }),
        (src, dst) => {
          fc.pre(src !== dst);
          const mutated = cloneCatalog();
          const dupId = mutated[src].id;
          mutated[dst] = { ...mutated[dst], id: dupId };
          const result = validateCatalog(mutated);
          expect(result.valid).toBe(false);
          expect(
            result.errors.some(
              (e) => e.includes('duplicate id') && e.includes(dupId),
            ),
          ).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects a broken noteCount (Requirement 2.4)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 6 }),
        fc.integer({ min: 1, max: 3 }),
        (idx, delta) => {
          const mutated = cloneCatalog();
          const target = mutated[idx];
          target.noteCount = target.semitonesFromRoot.length + delta;
          const result = validateCatalog(mutated);
          expect(result.valid).toBe(false);
          expect(
            result.errors.some(
              (e) => e.includes('note-count') && e.includes(target.id),
            ),
          ).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects a broken stacked structure / semitones agreement (Requirement 2.5)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 6 }),
        fc.integer({ min: 1, max: 5 }),
        (idx, bump) => {
          const mutated = cloneCatalog();
          const target = mutated[idx];
          // Perturb the last offset so successive diffs no longer match the
          // recorded stackedStructure while offsets still ascend.
          const last = target.semitonesFromRoot.length - 1;
          target.semitonesFromRoot[last] += bump;
          const result = validateCatalog(mutated);
          expect(result.valid).toBe(false);
          expect(
            result.errors.some(
              (e) => e.includes('structure mismatch') && e.includes(target.id),
            ),
          ).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
