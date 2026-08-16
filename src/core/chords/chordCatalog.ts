/**
 * The canonical chord catalog and its validation.
 *
 * This module is the single source of truth for chord-type facts (id, UI label,
 * note count, stacked semitone structure, semitones-from-root offsets, and a
 * spelled example on root C). Every other chord module derives from it. It is
 * pure and framework-free, mirroring `src/core/theory/intervalCatalog.ts`.
 */

/** A single chord type in the catalog. */
export interface ChordType {
  /** Canonical unique id, e.g. "maj", "dim7". */
  id: string;
  /** UI label shown on chips and options, e.g. "Maj", "Dim7". */
  uiLabel: string;
  /** Number of chord tones (== semitonesFromRoot.length). */
  noteCount: number;
  /** Ordered semitone gaps between successive tones, e.g. [4, 3] for maj. */
  stackedStructure: readonly number[];
  /** Semitone offsets of every tone from the root, ascending from 0. */
  semitonesFromRoot: readonly number[];
  /** Spelled example tones for a root of C, e.g. ["C", "E", "G"]. */
  example: readonly string[];
}

/** Result of validating the catalog against its structural invariants. */
export interface CatalogValidationResult {
  valid: boolean;
  /** Human-readable descriptions of each defect found. */
  errors: string[];
}

/**
 * The canonical seven-entry chord catalog, in canonical order. Each entry's
 * `id` is unique. `example` shows the spelled tones for a root of C.
 */
export const CHORD_CATALOG: readonly ChordType[] = [
  { id: 'maj', uiLabel: 'Maj', noteCount: 3, stackedStructure: [4, 3], semitonesFromRoot: [0, 4, 7], example: ['C', 'E', 'G'] },
  { id: 'min', uiLabel: 'min', noteCount: 3, stackedStructure: [3, 4], semitonesFromRoot: [0, 3, 7], example: ['C', 'Eb', 'G'] },
  { id: 'aug', uiLabel: 'Aug', noteCount: 3, stackedStructure: [4, 4], semitonesFromRoot: [0, 4, 8], example: ['C', 'E', 'G#'] },
  { id: 'maj7', uiLabel: 'Maj7', noteCount: 4, stackedStructure: [4, 3, 4], semitonesFromRoot: [0, 4, 7, 11], example: ['C', 'E', 'G', 'B'] },
  { id: 'min7', uiLabel: 'min7', noteCount: 4, stackedStructure: [3, 4, 3], semitonesFromRoot: [0, 3, 7, 10], example: ['C', 'Eb', 'G', 'Bb'] },
  { id: 'dom7', uiLabel: 'Dom7', noteCount: 4, stackedStructure: [4, 3, 3], semitonesFromRoot: [0, 4, 7, 10], example: ['C', 'E', 'G', 'Bb'] },
  { id: 'dim7', uiLabel: 'Dim7', noteCount: 4, stackedStructure: [3, 3, 3], semitonesFromRoot: [0, 3, 6, 9], example: ['C', 'Eb', 'Gb', 'Bbb'] },
];

/** Lookup map from catalog id to its entry. */
export const CATALOG_BY_ID: ReadonlyMap<string, ChordType> = new Map(
  CHORD_CATALOG.map((entry) => [entry.id, entry]),
);

/**
 * Validate a catalog against Requirement 2's structural invariants:
 * - exactly 7 entries (2.2)
 * - unique ids (2.3)
 * - each entry's `noteCount` equals `semitonesFromRoot.length` (2.4)
 * - successive differences of `semitonesFromRoot` equal `stackedStructure` (2.5)
 *
 * Returns `{ valid: true, errors: [] }` when every invariant holds (2.6).
 * Never throws; defects are accumulated as descriptive error strings.
 */
export function validateCatalog(
  catalog: readonly ChordType[],
): CatalogValidationResult {
  const errors: string[] = [];

  // 2.2 — entry count must be exactly seven.
  if (catalog.length !== 7) {
    errors.push(`expected 7 entries got ${catalog.length}`);
  }

  // 2.3 — ids must be unique.
  const seen = new Map<string, number>();
  for (const entry of catalog) {
    seen.set(entry.id, (seen.get(entry.id) ?? 0) + 1);
  }
  for (const [id, count] of seen) {
    if (count > 1) {
      errors.push(`duplicate id ${id}`);
    }
  }

  for (const entry of catalog) {
    // 2.4 — recorded note count must match the semitones-from-root length.
    if (entry.noteCount !== entry.semitonesFromRoot.length) {
      errors.push(
        `note-count mismatch for ${entry.id}: noteCount ${entry.noteCount} !== semitonesFromRoot length ${entry.semitonesFromRoot.length}`,
      );
    }

    // 2.5 — successive differences of semitonesFromRoot must equal stackedStructure.
    const diffs: number[] = [];
    for (let i = 1; i < entry.semitonesFromRoot.length; i += 1) {
      diffs.push(entry.semitonesFromRoot[i] - entry.semitonesFromRoot[i - 1]);
    }
    const structure = entry.stackedStructure;
    const structureMatches =
      diffs.length === structure.length &&
      diffs.every((d, i) => d === structure[i]);
    if (!structureMatches) {
      errors.push(
        `structure mismatch for ${entry.id}: successive diffs [${diffs.join(', ')}] !== stackedStructure [${structure.join(', ')}]`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * The validation result for the canonical catalog, computed once at import.
 * A catalog regression is caught by the test suite and can be surfaced
 * defensively before selection.
 */
export const CATALOG_VALIDATION: CatalogValidationResult =
  validateCatalog(CHORD_CATALOG);

/** The display label used by chips and options (== entry.uiLabel). */
export function displayLabel(entry: ChordType): string {
  return entry.uiLabel;
}
