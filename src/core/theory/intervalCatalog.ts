/**
 * The canonical RCM6 interval catalog and its validation.
 *
 * This module is the single source of truth for interval facts (number,
 * quality, semitones, English abbreviation, Chinese display name). Every other
 * theory module derives from it. It is pure and framework-free.
 */

/** Diatonic interval degree, 1 (unison) through 8 (octave). */
export type IntervalNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Interval quality. */
export type IntervalQuality =
  | 'diminished'
  | 'minor'
  | 'perfect'
  | 'major'
  | 'augmented';

/** A single named interval in the catalog. */
export interface CatalogInterval {
  /** Canonical unique ID = English abbreviation, e.g. "P1", "A4", "d5". */
  id: string;
  /** 1..8, diatonic degree. */
  number: IntervalNumber;
  quality: IntervalQuality;
  /** 0..13 semitone count. */
  semitones: number;
  /** English abbreviation, e.g. "P1", "M3". */
  abbr: string;
  /** English name, e.g. "Perfect 1st". */
  englishName: string;
  /** Chinese display name, e.g. "纯一度". */
  chineseName: string;
}

/** Result of validating a catalog against the RCM6 invariants. */
export interface CatalogValidationResult {
  valid: boolean;
  /** e.g. "missing d5", "duplicate (3,perfect)", "expected 27 got 28". */
  errors: string[];
}

/**
 * The RCM6 interval catalog: exactly 27 entries, ordered by `number` then by
 * the requirements-table order. Each entry's `id` equals its English
 * abbreviation and is unique across the catalog.
 */
export const INTERVAL_CATALOG: readonly CatalogInterval[] = [
  // 1st
  { id: 'P1', number: 1, quality: 'perfect', semitones: 0, abbr: 'P1', englishName: 'Perfect 1st', chineseName: '纯一度' },
  { id: 'A1', number: 1, quality: 'augmented', semitones: 1, abbr: 'A1', englishName: 'Augmented 1st', chineseName: '增一度' },
  // 2nd
  { id: 'd2', number: 2, quality: 'diminished', semitones: 0, abbr: 'd2', englishName: 'Diminished 2nd', chineseName: '减二度' },
  { id: 'm2', number: 2, quality: 'minor', semitones: 1, abbr: 'm2', englishName: 'Minor 2nd', chineseName: '小二度' },
  { id: 'M2', number: 2, quality: 'major', semitones: 2, abbr: 'M2', englishName: 'Major 2nd', chineseName: '大二度' },
  { id: 'A2', number: 2, quality: 'augmented', semitones: 3, abbr: 'A2', englishName: 'Augmented 2nd', chineseName: '增二度' },
  // 3rd
  { id: 'd3', number: 3, quality: 'diminished', semitones: 2, abbr: 'd3', englishName: 'Diminished 3rd', chineseName: '减三度' },
  { id: 'm3', number: 3, quality: 'minor', semitones: 3, abbr: 'm3', englishName: 'Minor 3rd', chineseName: '小三度' },
  { id: 'M3', number: 3, quality: 'major', semitones: 4, abbr: 'M3', englishName: 'Major 3rd', chineseName: '大三度' },
  { id: 'A3', number: 3, quality: 'augmented', semitones: 5, abbr: 'A3', englishName: 'Augmented 3rd', chineseName: '增三度' },
  // 4th
  { id: 'd4', number: 4, quality: 'diminished', semitones: 4, abbr: 'd4', englishName: 'Diminished 4th', chineseName: '减四度' },
  { id: 'P4', number: 4, quality: 'perfect', semitones: 5, abbr: 'P4', englishName: 'Perfect 4th', chineseName: '纯四度' },
  { id: 'A4', number: 4, quality: 'augmented', semitones: 6, abbr: 'A4', englishName: 'Augmented 4th', chineseName: '增四度' },
  // 5th
  { id: 'd5', number: 5, quality: 'diminished', semitones: 6, abbr: 'd5', englishName: 'Diminished 5th', chineseName: '减五度' },
  { id: 'P5', number: 5, quality: 'perfect', semitones: 7, abbr: 'P5', englishName: 'Perfect 5th', chineseName: '纯五度' },
  { id: 'A5', number: 5, quality: 'augmented', semitones: 8, abbr: 'A5', englishName: 'Augmented 5th', chineseName: '增五度' },
  // 6th
  { id: 'd6', number: 6, quality: 'diminished', semitones: 7, abbr: 'd6', englishName: 'Diminished 6th', chineseName: '减六度' },
  { id: 'm6', number: 6, quality: 'minor', semitones: 8, abbr: 'm6', englishName: 'Minor 6th', chineseName: '小六度' },
  { id: 'M6', number: 6, quality: 'major', semitones: 9, abbr: 'M6', englishName: 'Major 6th', chineseName: '大六度' },
  { id: 'A6', number: 6, quality: 'augmented', semitones: 10, abbr: 'A6', englishName: 'Augmented 6th', chineseName: '增六度' },
  // 7th
  { id: 'd7', number: 7, quality: 'diminished', semitones: 9, abbr: 'd7', englishName: 'Diminished 7th', chineseName: '减七度' },
  { id: 'm7', number: 7, quality: 'minor', semitones: 10, abbr: 'm7', englishName: 'Minor 7th', chineseName: '小七度' },
  { id: 'M7', number: 7, quality: 'major', semitones: 11, abbr: 'M7', englishName: 'Major 7th', chineseName: '大七度' },
  { id: 'A7', number: 7, quality: 'augmented', semitones: 12, abbr: 'A7', englishName: 'Augmented 7th', chineseName: '增七度' },
  // 8th
  { id: 'd8', number: 8, quality: 'diminished', semitones: 11, abbr: 'd8', englishName: 'Diminished Octave', chineseName: '减八度' },
  { id: 'P8', number: 8, quality: 'perfect', semitones: 12, abbr: 'P8', englishName: 'Perfect Octave', chineseName: '纯八度' },
  { id: 'A8', number: 8, quality: 'augmented', semitones: 13, abbr: 'A8', englishName: 'Augmented Octave', chineseName: '增八度' },
];

/** Lookup map from catalog id to its entry. */
export const CATALOG_BY_ID: ReadonlyMap<string, CatalogInterval> = new Map(
  INTERVAL_CATALOG.map((entry) => [entry.id, entry]),
);

/** Chinese quality labels for the coarse quality dropdown and display. */
export const QUALITY_LABELS: Record<IntervalQuality, string> = {
  perfect: '纯',
  major: '大',
  minor: '小',
  diminished: '减',
  augmented: '增',
};

/** Chinese number labels for the coarse number dropdown and display. */
export const NUMBER_LABELS: Record<IntervalNumber, string> = {
  1: '一度',
  2: '二度',
  3: '三度',
  4: '四度',
  5: '五度',
  6: '六度',
  7: '七度',
  8: '八度',
};

/**
 * The display name shared by the fine control and the options, of the form
 * "纯一度 (P1)" — Chinese name followed by the English abbreviation.
 */
export function displayName(entry: CatalogInterval): string {
  return `${entry.chineseName} (${entry.abbr})`;
}

/**
 * The set of `(number, quality)` pairs that must appear in the catalog exactly
 * once. Derived from the two interval families.
 */
const PERFECT_FAMILY_NUMBERS: readonly IntervalNumber[] = [1, 4, 5, 8];
const MAJOR_MINOR_FAMILY_NUMBERS: readonly IntervalNumber[] = [2, 3, 6, 7];
const PERFECT_FAMILY_QUALITIES: readonly IntervalQuality[] = [
  'diminished',
  'perfect',
  'augmented',
];
const MAJOR_MINOR_FAMILY_QUALITIES: readonly IntervalQuality[] = [
  'diminished',
  'minor',
  'major',
  'augmented',
];

function pairKey(number: IntervalNumber, quality: IntervalQuality): string {
  return `${number},${quality}`;
}

/** Build the set of required `(number, quality)` pair keys (27 total). */
function requiredPairKeys(): Set<string> {
  const keys = new Set<string>();
  for (const n of PERFECT_FAMILY_NUMBERS) {
    for (const q of PERFECT_FAMILY_QUALITIES) {
      keys.add(pairKey(n, q));
    }
  }
  for (const n of MAJOR_MINOR_FAMILY_NUMBERS) {
    for (const q of MAJOR_MINOR_FAMILY_QUALITIES) {
      keys.add(pairKey(n, q));
    }
  }
  return keys;
}

/**
 * Validate a catalog against the RCM6 invariants (Requirement 2):
 * - exactly 27 entries
 * - every required `(number, quality)` pair present exactly once
 * - no extra `(number, quality)` pairs
 * - no duplicate `(number, quality)` pair
 * - every `semitones` within 0..13
 */
export function validateCatalog(
  catalog: readonly CatalogInterval[],
): CatalogValidationResult {
  const errors: string[] = [];
  const required = requiredPairKeys();

  if (catalog.length !== 27) {
    errors.push(`expected 27 got ${catalog.length}`);
  }

  // Count occurrences of each (number, quality) pair.
  const seen = new Map<string, number>();
  for (const entry of catalog) {
    const key = pairKey(entry.number, entry.quality);
    seen.set(key, (seen.get(key) ?? 0) + 1);

    if (
      !Number.isInteger(entry.semitones) ||
      entry.semitones < 0 ||
      entry.semitones > 13
    ) {
      errors.push(`semitones out of range for ${entry.id}: ${entry.semitones}`);
    }
  }

  // Duplicates and extras.
  for (const [key, count] of seen) {
    if (count > 1) {
      errors.push(`duplicate (${key})`);
    }
    if (!required.has(key)) {
      errors.push(`unexpected (${key})`);
    }
  }

  // Missing required pairs.
  for (const key of required) {
    if (!seen.has(key)) {
      errors.push(`missing (${key})`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * The validation result for the canonical catalog, computed once at import.
 * Consumers surface these errors and block selection if the catalog is
 * invalid (a developer-facing guard against catalog regressions).
 */
export const CATALOG_VALIDATION: CatalogValidationResult =
  validateCatalog(INTERVAL_CATALOG);
