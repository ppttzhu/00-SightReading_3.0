/**
 * The Chord_Resolver for the RCM Level 6 chord-progression exercise (part of the
 * Theory_Layer).
 *
 * Given a Key, Mode, and a {@link ChordSpec}, {@link resolveChord} returns the
 * correctly-spelled tones of a single root-position triad. It is pure and
 * framework-free (no React, VexFlow, or Tone.js imports), mirroring the
 * discipline of `src/core/chords/chordGenerator.ts`, whose proven spelling
 * primitives (`LETTERS`, `LETTER_SEMITONES`, `parsePitch`, `accidentalForDiff`,
 * the ±2 accidental limit, and the stacked-thirds letter walk) are reused here.
 *
 * The resolver builds each triad's quality from the {@link ChordSpec.quality}
 * field, NOT from the unaltered natural-scale degree. A minor-key dominant
 * (`degree 5, quality 'major'`) therefore resolves to a MAJOR triad on the
 * raised leading tone — A minor V = `E–G#–B`, never `E–G–B` (Requirement 4).
 *
 * The diatonic degree letter (and its key-signature accidental) comes from
 * {@link diatonicDegrees}, guaranteeing enharmonically correct spelling for the
 * selected Key; the third and fifth are then spelled as stacked thirds above
 * the root letter with the accidental chosen so each tone sounds at the target
 * semitone offset dictated by `spec.quality`.
 */

import type { KeyName, Mode } from './keys';
import { diatonicDegrees } from './keys';
import type { ChordSpec } from './progressions';

// ============================================================
// Types
// ============================================================

/**
 * A resolved chord: the spelled tones low→high (root first) with parallel MIDI
 * values and octave-stripped spellings.
 *
 * The spelled `pitches` (and `spelled`) are the source of truth for note names;
 * `midis` are derived and kept parallel. Root-position invariant: `midis` is
 * strictly ascending and `midis[0]` is the lowest (the root).
 */
export interface ResolvedChord {
  /** Spelled tones with octave, root first, low→high, e.g. `["E4","G#4","B4"]`. */
  pitches: string[];
  /** MIDI values parallel to `pitches`, strictly ascending (root lowest). */
  midis: number[];
  /** Letter+accidental tones without octave, e.g. `["E","G#","B"]`. */
  spelled: string[];
}

// ============================================================
// Letter / semitone / accidental helpers (reused from chordGenerator)
// ============================================================

/** Letter names in diatonic order (a full octave walk). */
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

/** Letter → its index within an octave (C = 0 … B = 6). */
const LETTER_INDEX: Record<string, number> = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6,
};

/** Letter → its natural semitone offset within an octave. */
const LETTER_SEMITONES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** Accidental string → semitone offset. */
const ACCIDENTAL_OFFSET: Record<string, number> = {
  '': 0,
  '#': 1,
  '##': 2,
  b: -1,
  bb: -2,
};

/**
 * Build an accidental string from a semitone difference, or `null` if the
 * magnitude would exceed a double accidental (`|diff| > 2`). Mirrors
 * `chordGenerator.accidentalForDiff`.
 */
function accidentalForDiff(diff: number): string | null {
  if (diff > 2 || diff < -2) return null;
  if (diff === 0) return '';
  return diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff);
}

/**
 * Semitone offsets from the root for the tones of a triad of the given quality:
 * a major triad is `[0, 4, 7]` and a minor triad is `[0, 3, 7]` (Requirements
 * 14.2, 14.3). The offsets come from the {@link ChordSpec.quality} field, so a
 * minor-key V with `quality: 'major'` yields the major offsets and raises the
 * third to the leading tone (Requirement 3.6, 4.1).
 */
function semitonesFromQuality(quality: ChordSpec['quality']): [number, number, number] {
  return quality === 'major' ? [0, 4, 7] : [0, 3, 7];
}

// ============================================================
// Base octave
// ============================================================

/**
 * Default octave for a chord root when none is supplied. Placing the tonic root
 * at octave 4 keeps the whole progression in a comfortable, playable range and
 * guarantees the root is the lowest note of each chord.
 */
export const DEFAULT_ROOT_OCTAVE = 4;

// ============================================================
// Resolution
// ============================================================

/**
 * Resolve a single {@link ChordSpec} in a given Key and Mode to correctly
 * spelled, root-position triad tones.
 *
 * Algorithm:
 * 1. `degrees = diatonicDegrees(key, mode)` — the seven diatonic degree
 *    spellings (index 0 = tonic).
 * 2. `rootLetterAcc = degrees[spec.degree - 1]` — the diatonic root spelling
 *    (letter + key-signature accidental). The root is placed at
 *    {@link BASE_OCTAVE} so the whole triad is playable and the root is lowest.
 * 3. Build a root-position triad by stacked thirds from the root LETTER (root,
 *    +2 letters, +4 letters). For each tone the accidental is chosen so the tone
 *    sounds at `rootMidi + semitonesFromQuality(spec.quality)[i]`, exactly as
 *    `chordGenerator.spellChord` derives tones from `semitonesFromRoot`.
 * 4. Because the offsets come from `spec.quality` (not the natural scale), a
 *    minor-key V (`{ degree: 5, quality: 'major' }`) raises the third to the
 *    leading tone — A minor V = `E, G#, B`; C minor V = `G, B, D`; D minor V =
 *    `A, C#, E`; F minor V = `C, E, G` (Requirement 4).
 *
 * Root position only (root index 0 and lowest). The `rootOctave` parameter
 * shifts every tone by whole octaves only and NEVER changes the Spelled_Pitch
 * letters/accidentals (Requirement 15.7). Deterministic: the same
 * `(key, mode, spec, rootOctave)` always yields identical spellings
 * (Requirement 14.4). Pure; never throws for supported Level 6 inputs — every
 * supported Key/spec spells within ±2 accidentals.
 *
 * @param key        the tonic, spelled as a letter plus optional accidental
 * @param mode       `'major'` or `'minor'`
 * @param spec       the structural chord specification to resolve
 * @param rootOctave the octave of the chord root (default {@link DEFAULT_ROOT_OCTAVE})
 * @returns the resolved root-position triad
 */
export function resolveChord(
  key: KeyName,
  mode: Mode,
  spec: ChordSpec,
  rootOctave: number = DEFAULT_ROOT_OCTAVE,
): ResolvedChord {
  const degrees = diatonicDegrees(key, mode);
  const rootLetterAcc = degrees[spec.degree - 1];

  // Parse the diatonic root spelling into its letter and accidental, then place
  // it in the requested octave so the root is the lowest tone.
  const rootLetter = rootLetterAcc.charAt(0);
  const rootAccidental = rootLetterAcc.slice(1);
  const rootDiatonicStep = LETTER_INDEX[rootLetter] + rootOctave * 7;
  const rootMidi =
    LETTER_SEMITONES[rootLetter] +
    (ACCIDENTAL_OFFSET[rootAccidental] ?? 0) +
    (rootOctave + 1) * 12;

  const offsets = semitonesFromQuality(spec.quality);

  const pitches: string[] = [];
  const midis: number[] = [];
  const spelled: string[] = [];

  for (let i = 0; i < offsets.length; i += 1) {
    // Stacked thirds: skip one letter name between adjacent tones.
    const diatonicStep = rootDiatonicStep + 2 * i;
    const letterIdx = ((diatonicStep % 7) + 7) % 7;
    const octave = Math.floor(diatonicStep / 7);
    const letter = LETTERS[letterIdx];

    const naturalMidi = LETTER_SEMITONES[letter] + (octave + 1) * 12;
    const targetMidi = rootMidi + offsets[i];
    const diff = targetMidi - naturalMidi;

    const accidental = accidentalForDiff(diff);
    // For every supported Level 6 Key/spec the accidental is within ±2, so this
    // guard is defensive: surface a defect rather than emit a malformed pitch.
    if (accidental === null) {
      throw new Error(
        `resolveChord: tone ${i} of ${key} ${mode} degree ${spec.degree} ` +
          `(${spec.quality}) requires more than a double accidental`,
      );
    }

    pitches.push(`${letter}${accidental}${octave}`);
    midis.push(targetMidi);
    spelled.push(`${letter}${accidental}`);
  }

  return { pitches, midis, spelled };
}

// ============================================================
// Progression voicing (ascending bass line)
// ============================================================

/**
 * Resolve a whole Progression (an ordered Chord_Spec sequence) with the RCM
 * Level 6 **ascending bass line** voicing (Requirement 15).
 *
 * The RCM Level 6 aural test voices the bass rising from the tonic: the first
 * chord is the tonic; the middle chord's root sounds strictly ABOVE the
 * starting tonic (never below it); and the final tonic is the Upper_Tonic, one
 * octave above the start. For C major this is `C4 → G4 → C5` (I–V–I) or
 * `C4 → F4 → C5` (I–IV–I) — never `C4 → G3 → C4`.
 *
 * Algorithm:
 * 1. Resolve chord 0 (the tonic) at {@link DEFAULT_ROOT_OCTAVE}; its Bass_Note
 *    (root, the lowest tone) is the starting tonic.
 * 2. For each subsequent chord, pick the LOWEST root octave whose Bass_Note
 *    (root MIDI) is strictly greater than the previous chord's Bass_Note. This
 *    forces the middle chord's root above the starting tonic (15.3, 15.4), and
 *    because the final tonic shares the tonic letter, the lowest octave strictly
 *    above the middle chord's root lands it on the Upper_Tonic (15.5).
 *
 * The result's Bass_Notes are non-decreasing and strictly ascend first→last
 * (15.6). Voicing shifts octaves only; spelling is identical to `resolveChord`
 * at the default octave (15.7). Pure and deterministic; never throws for
 * supported Level 6 inputs.
 *
 * @param key   the tonic, spelled as a letter plus optional accidental
 * @param mode  `'major'` or `'minor'`
 * @param specs the ordered Chord_Spec sequence (three at Level 6)
 * @returns the resolved chords in progression order with an ascending bass line
 */
export function resolveProgression(
  key: KeyName,
  mode: Mode,
  specs: readonly ChordSpec[],
): ResolvedChord[] {
  const chords: ResolvedChord[] = [];
  let previousBassMidi = -Infinity;

  for (let i = 0; i < specs.length; i += 1) {
    const spec = specs[i];

    if (i === 0) {
      // The starting tonic anchors the progression at the default octave.
      const chord = resolveChord(key, mode, spec, DEFAULT_ROOT_OCTAVE);
      chords.push(chord);
      previousBassMidi = chord.midis[0];
      continue;
    }

    // Find the lowest root octave whose Bass_Note is strictly above the
    // previous chord's Bass_Note, so the bass line ascends.
    let octave = DEFAULT_ROOT_OCTAVE;
    let chord = resolveChord(key, mode, spec, octave);
    while (chord.midis[0] <= previousBassMidi) {
      octave += 1;
      chord = resolveChord(key, mode, spec, octave);
    }
    chords.push(chord);
    previousBassMidi = chord.midis[0];
  }

  return chords;
}
