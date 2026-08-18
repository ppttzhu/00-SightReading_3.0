/**
 * Example-based unit tests for the Chord_Resolver (`resolveChord`), anchoring
 * the concrete spellings called out in the requirements/spec tables (task 3.7).
 *
 * These complement the property tests with exact, human-verifiable spellings
 * of specific chords, comparing octave-stripped `spelled` arrays.
 */

import { describe, it, expect } from 'vitest';

import { CHORD_SPECS } from '../progressions';
import { resolveChord } from '../chordResolver';

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
