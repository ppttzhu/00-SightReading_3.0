/**
 * Example-based unit tests for full Level 6 progressions (task 4.5).
 *
 * These anchors verify the three-chord GRAND-STAFF voicing deterministically by
 * resolving each progression's Chord_Specs with `resolveProgression` in a fixed
 * Key/Mode — exactly what the Question_Generator does. Each chord is a
 * left-hand bass root (in the bass register) plus a right-hand triad; the
 * right-hand triad's letters match the single-chord resolver, and the final
 * tonic returns to the exact starting voicing (no octave jump).
 */

import { describe, it, expect } from 'vitest';

import { CHORD_SPECS } from '../progressions';
import { resolveChord, resolveProgression } from '../chordResolver';

/** A fixed rng that always returns 0, for deterministic voicing in examples. */
const zeroRng = () => 0;

/** Comfortable left-hand bass register (octave 2–3): C2..B3 inclusive. */
const BASS_MIN_MIDI = 36;
const BASS_MAX_MIDI = 59;
/** Right-hand register floor (G3). The bass must stay strictly below this. */
const RIGHT_HAND_MIN_MIDI = 55;

/** Sort a triad's letter set (ignoring octave) for order-independent compare. */
function letterSet(spelled: string[]): string[] {
  return [...spelled].sort();
}

const PROGRESSIONS: Array<{
  name: string;
  key: string;
  mode: 'major' | 'minor';
  specs: (typeof CHORD_SPECS)[keyof typeof CHORD_SPECS][];
}> = [
  { name: 'C major I–V–I', key: 'C', mode: 'major', specs: [CHORD_SPECS.I, CHORD_SPECS.V, CHORD_SPECS.I] },
  { name: 'C major I–IV–I', key: 'C', mode: 'major', specs: [CHORD_SPECS.I, CHORD_SPECS.IV, CHORD_SPECS.I] },
  { name: 'C minor i–iv–i', key: 'C', mode: 'minor', specs: [CHORD_SPECS.i, CHORD_SPECS.iv, CHORD_SPECS.i] },
  { name: 'A minor i–V–i', key: 'A', mode: 'minor', specs: [CHORD_SPECS.i, CHORD_SPECS.V, CHORD_SPECS.i] },
];

describe('full progressions — grand-staff voicing (Requirements 2.4–2.7)', () => {
  for (const { name, key, mode, specs } of PROGRESSIONS) {
    describe(name, () => {
      const chords = resolveProgression(key, mode, specs, zeroRng);

      it('resolves three grand-staff chords', () => {
        expect(chords).toHaveLength(3);
      });

      it('plays a single bass root per chord, in the bass register below the right hand', () => {
        chords.forEach((chord, i) => {
          const rootLetter = resolveChord(key, mode, specs[i]).spelled[0];
          expect(chord.leftHand.spelled).toBe(rootLetter);
          expect(chord.leftHand.midi).toBeGreaterThanOrEqual(BASS_MIN_MIDI);
          expect(chord.leftHand.midi).toBeLessThanOrEqual(BASS_MAX_MIDI);
          // Strictly below the right-hand floor, so the hands never overlap.
          expect(chord.leftHand.midi).toBeLessThan(RIGHT_HAND_MIN_MIDI);
          expect(chord.leftHand.midi).toBeLessThan(chord.rightHand.midis[0]);
        });
      });

      it('plays the full triad in the right hand, letters matching the resolved triad', () => {
        chords.forEach((chord, i) => {
          expect(chord.rightHand.pitches).toHaveLength(3);
          expect(chord.rightHand.midis[0]).toBeLessThan(chord.rightHand.midis[1]);
          expect(chord.rightHand.midis[1]).toBeLessThan(chord.rightHand.midis[2]);
          expect(letterSet(chord.rightHand.spelled)).toEqual(
            letterSet(resolveChord(key, mode, specs[i]).spelled),
          );
        });
      });

      it('returns to the exact starting voicing on the final tonic (no octave jump)', () => {
        expect(chords[2].rightHand.pitches).toEqual(chords[0].rightHand.pitches);
        expect(chords[2].leftHand.pitch).toBe(chords[0].leftHand.pitch);
      });
    });
  }
});
