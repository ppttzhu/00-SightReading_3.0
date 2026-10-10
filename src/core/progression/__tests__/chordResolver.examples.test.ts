/**
 * Example-based unit tests for the Chord_Resolver (`resolveChord`), anchoring
 * the concrete spellings called out in the requirements/spec tables (task 3.7).
 *
 * These complement the property tests with exact, human-verifiable spellings
 * of specific chords, comparing octave-stripped `spelled` arrays.
 */

import { describe, it, expect } from 'vitest';

import { CHORD_SPECS } from '../progressions';
import { resolveChord, resolveProgression } from '../chordResolver';

/** A fixed rng that always returns 0, for deterministic voicing in examples. */
const zeroRng = () => 0;

describe('resolveChord — concrete spec anchors', () => {
  describe('minor-key dominant (V) — raised leading tone (Requirements 4.3, 4.4, 4.5)', () => {
    it('A minor V = E, G#, B', () => {
      expect(resolveChord('A', 'minor', CHORD_SPECS.V).spelled).toEqual([
        'E',
        'G#',
        'B',
      ]);
    });

    it('C minor V = G, B, D', () => {
      expect(resolveChord('C', 'minor', CHORD_SPECS.V).spelled).toEqual([
        'G',
        'B',
        'D',
      ]);
    });

    it('D minor V = A, C#, E', () => {
      expect(resolveChord('D', 'minor', CHORD_SPECS.V).spelled).toEqual([
        'A',
        'C#',
        'E',
      ]);
    });

    it('F minor V = C, E, G', () => {
      expect(resolveChord('F', 'minor', CHORD_SPECS.V).spelled).toEqual([
        'C',
        'E',
        'G',
      ]);
    });
  });

  describe('enharmonically correct spellings (Requirements 5.3, 5.4, 5.5)', () => {
    it('F# major IV = B, D#, F#', () => {
      expect(resolveChord('F#', 'major', CHORD_SPECS.IV).spelled).toEqual([
        'B',
        'D#',
        'F#',
      ]);
    });

    it('Eb major V = Bb, D, F', () => {
      expect(resolveChord('Eb', 'major', CHORD_SPECS.V).spelled).toEqual([
        'Bb',
        'D',
        'F',
      ]);
    });

    it('C# minor iv = F#, A, C#', () => {
      expect(resolveChord('C#', 'minor', CHORD_SPECS.iv).spelled).toEqual([
        'F#',
        'A',
        'C#',
      ]);
    });
  });
});

/** Sort a triad's letter set (ignoring octave) for order-independent comparison. */
function letterSet(spelled: string[]): string[] {
  return [...spelled].sort();
}

describe('resolveProgression — grand-staff voicing contract', () => {
  // Comfortable left-hand bass register (octave 2–3) per BASS_OCTAVE_CANDIDATES.
  const BASS_MIN_MIDI = 36; // C2
  const BASS_MAX_MIDI = 59; // B3

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

  for (const { name, key, mode, specs } of PROGRESSIONS) {
    describe(name, () => {
      const chords = resolveProgression(key, mode, specs, zeroRng);

      it('resolves three grand-staff chords', () => {
        expect(chords).toHaveLength(3);
      });

      it('plays a single left-hand bass root in the bass register for every chord', () => {
        chords.forEach((chord, i) => {
          // Left hand is the chord root (same letter as the single-chord resolver's root).
          const expectedRootLetter = resolveChord(key, mode, specs[i]).spelled[0];
          expect(chord.leftHand.spelled).toBe(expectedRootLetter);
          // ...sitting in a comfortable bass register.
          expect(chord.leftHand.midi).toBeGreaterThanOrEqual(BASS_MIN_MIDI);
          expect(chord.leftHand.midi).toBeLessThanOrEqual(BASS_MAX_MIDI);
        });
      });

      it('plays the full triad in the right hand, letters matching the resolved triad', () => {
        chords.forEach((chord, i) => {
          expect(chord.rightHand.pitches).toHaveLength(3);
          expect(chord.rightHand.midis).toHaveLength(3);
          // Right-hand midis strictly ascending (low→high voicing).
          expect(chord.rightHand.midis[0]).toBeLessThan(chord.rightHand.midis[1]);
          expect(chord.rightHand.midis[1]).toBeLessThan(chord.rightHand.midis[2]);
          // Same three triad tones (letters), regardless of inversion/octave.
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
