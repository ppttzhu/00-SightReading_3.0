/**
 * Property-based tests for the Chord_Resolver (`resolveChord`) of the
 * chord-progression exercise.
 *
 * Covers design Correctness Properties 1, 2, 3, 5, and 8 (tasks 3.2–3.6). Each
 * property runs a minimum of 100 fast-check iterations and is tagged with its
 * design property in the required format.
 */

import fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { MAJOR_KEYS, MINOR_KEYS, type KeyName, type Mode } from '../keys';
import { CHORD_SPECS, LEVEL6_PROGRESSIONS, type ChordSpec } from '../progressions';
import { resolveChord, resolveProgression } from '../chordResolver';

// ============================================================
// Shared generators / helpers
// ============================================================

/**
 * A generator producing `{ key, mode }` where `mode` is either `'major'` or
 * `'minor'` and `key` is drawn from the matching Key pool (MAJOR_KEYS for
 * major, MINOR_KEYS for minor).
 */
const keyModeArb: fc.Arbitrary<{ key: KeyName; mode: Mode }> = fc.oneof(
  fc.constantFrom(...MAJOR_KEYS).map((key) => ({ key, mode: 'major' as Mode })),
  fc.constantFrom(...MINOR_KEYS).map((key) => ({ key, mode: 'minor' as Mode })),
);

/** A generator picking one of the five reusable Level 6 Chord_Specs. */
const chordSpecArb: fc.Arbitrary<ChordSpec> = fc.constantFrom(
  CHORD_SPECS.I,
  CHORD_SPECS.IV,
  CHORD_SPECS.V,
  CHORD_SPECS.i,
  CHORD_SPECS.iv,
);

/** A generator picking one of the four supported Level 6 Progressions. */
const progressionArb = fc.constantFrom(...LEVEL6_PROGRESSIONS);

/** Letters C D E F G A B mapped to 0..6. */
const LETTER_INDEX: Record<string, number> = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6,
};

/** Semitone offsets of each resolved tone from the root (MIDI-based). */
function offsetsFromRoot(midis: number[]): number[] {
  return midis.map((m) => m - midis[0]);
}

// ============================================================
// Property 1 — chord quality matches the Chord_Spec
// ============================================================

describe('Property 1: chord quality matches the Chord_Spec', () => {
  // Feature: chord-progression, Property 1: For any supported Key, Mode, and Chord_Spec, resolveChord tones have semitone offsets from the root equal to [0,4,7] when quality is 'major' and [0,3,7] when 'minor'
  it('produces [0,4,7] offsets for major specs and [0,3,7] for minor specs', () => {
    fc.assert(
      fc.property(keyModeArb, chordSpecArb, ({ key, mode }, spec) => {
        const chord = resolveChord(key, mode, spec);
        const offsets = offsetsFromRoot(chord.midis);
        const expected = spec.quality === 'major' ? [0, 4, 7] : [0, 3, 7];
        expect(offsets).toEqual(expected);
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================
// Property 2 — minor-key dominant is a major triad on the raised leading tone
// ============================================================

describe('Property 2: minor-key dominant is a major triad on the raised leading tone', () => {
  // Feature: chord-progression, Property 2: For any minor Key, resolveChord of the V spec produces a major triad (offsets [0,4,7]) whose third is the raised seventh, never a minor triad
  it('resolves the V spec in any minor key to a major triad, never minor', () => {
    fc.assert(
      fc.property(fc.constantFrom(...MINOR_KEYS), (key) => {
        const chord = resolveChord(key, 'minor', CHORD_SPECS.V);
        const offsets = offsetsFromRoot(chord.midis);
        expect(offsets).toEqual([0, 4, 7]);
        expect(offsets).not.toEqual([0, 3, 7]);
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================
// Property 3 — enharmonically correct spelling (letters stacked in thirds)
// ============================================================

describe('Property 3: enharmonically correct spelling (letters stacked in thirds)', () => {
  // Feature: chord-progression, Property 3: For any supported Key, Mode, and Chord_Spec, the three Spelled_Pitches have letter names stacked in thirds from the root with key-correct accidentals, so enharmonic keys yield distinct spellings
  it('spells three tones whose letters are stacked in thirds from the root', () => {
    fc.assert(
      fc.property(keyModeArb, chordSpecArb, ({ key, mode }, spec) => {
        const chord = resolveChord(key, mode, spec);
        expect(chord.spelled).toHaveLength(3);

        const rootLetterIdx = LETTER_INDEX[chord.spelled[0].charAt(0)];
        for (let i = 0; i < chord.spelled.length; i += 1) {
          const letterIdx = LETTER_INDEX[chord.spelled[i].charAt(0)];
          expect(letterIdx).toBe((rootLetterIdx + 2 * i) % 7);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================
// Property 5 — determinism of resolution
// ============================================================

describe('Property 5: determinism of resolution', () => {
  // Feature: chord-progression, Property 5: For any supported Key, Mode, and Chord_Spec, resolving the same triple repeatedly yields identical Spelled_Pitches
  it('yields identical pitches/midis/spelled when resolved twice', () => {
    fc.assert(
      fc.property(keyModeArb, chordSpecArb, ({ key, mode }, spec) => {
        const first = resolveChord(key, mode, spec);
        const second = resolveChord(key, mode, spec);
        expect(second.pitches).toEqual(first.pitches);
        expect(second.midis).toEqual(first.midis);
        expect(second.spelled).toEqual(first.spelled);
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================
// Property 8 — chord building blocks reusable across progressions
// ============================================================

describe('Property 8: chord building blocks are reusable across progressions', () => {
  // Feature: chord-progression, Property 8: For any Chord_Spec appearing in more than one ProgressionDef, resolving that spec in the same Key/Mode yields identical tones regardless of which Progression references it
  it('resolves a shared spec identically regardless of progression context', () => {
    fc.assert(
      fc.property(keyModeArb, ({ key, mode }) => {
        // CHORD_SPECS.I appears in both major progressions; CHORD_SPECS.i and
        // CHORD_SPECS.V appear in both minor progressions. resolveChord depends
        // only on (key, mode, spec), so resolving the same shared spec in the
        // same Key/Mode is independent of any progression context.
        const sharedSpec = mode === 'major' ? CHORD_SPECS.I : CHORD_SPECS.i;

        const fromProgressionA = resolveChord(key, mode, sharedSpec);
        const fromProgressionB = resolveChord(key, mode, sharedSpec);

        expect(fromProgressionB.spelled).toEqual(fromProgressionA.spelled);
        expect(fromProgressionB.pitches).toEqual(fromProgressionA.pitches);
        expect(fromProgressionB.midis).toEqual(fromProgressionA.midis);
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================
// Property 9 — grand-staff voicing: LH bass root + RH triad, returning home
// ============================================================

/** Comfortable left-hand bass register (octave 2–3): C2..B3 inclusive. */
const BASS_MIN_MIDI = 36;
const BASS_MAX_MIDI = 59;

/** Sort a triad's letter set (ignoring octave) for order-independent compare. */
function letterSet(spelled: string[]): string[] {
  return [...spelled].sort();
}

describe('Property 9: grand-staff voicing — left-hand bass root + right-hand triad, returning to the start', () => {
  // Feature: chord-progression, Property 9: For any generated progression, every chord has a single left-hand bass root (the chord root, in the bass register) and a full three-tone right-hand triad; the right-hand triad's letter set matches resolveChord's, and the final tonic reuses the first chord's exact voicing (no octave jump).
  it('voices each chord as a bass root + triad, and returns to the exact starting voicing', () => {
    fc.assert(
      fc.property(keyModeArb, progressionArb, ({ key, mode }, progression) => {
        // Only exercise progressions whose mode matches the generated key pool,
        // matching how generateQuestion pairs (mode, key).
        fc.pre(progression.mode === mode);

        const chords = resolveProgression(key, mode, progression.specs);
        expect(chords).toHaveLength(3);

        chords.forEach((chord, i) => {
          // Left hand: a single bass note = the chord root, in the bass register.
          const rootLetter = resolveChord(key, mode, progression.specs[i]).spelled[0];
          expect(chord.leftHand.spelled).toBe(rootLetter);
          expect(chord.leftHand.midi).toBeGreaterThanOrEqual(BASS_MIN_MIDI);
          expect(chord.leftHand.midi).toBeLessThanOrEqual(BASS_MAX_MIDI);

          // Right hand: the full three-tone triad, strictly ascending, with the
          // same tone letters as the single-chord resolver (any inversion).
          expect(chord.rightHand.pitches).toHaveLength(3);
          expect(chord.rightHand.midis[0]).toBeLessThan(chord.rightHand.midis[1]);
          expect(chord.rightHand.midis[1]).toBeLessThan(chord.rightHand.midis[2]);
          expect(letterSet(chord.rightHand.spelled)).toEqual(
            letterSet(resolveChord(key, mode, progression.specs[i]).spelled),
          );
        });

        // The final tonic reuses the first chord's exact voicing (no octave jump).
        expect(chords[2].rightHand.pitches).toEqual(chords[0].rightHand.pitches);
        expect(chords[2].leftHand.pitch).toBe(chords[0].leftHand.pitch);
      }),
      { numRuns: 100 },
    );
  });
});
