import { describe, it, expect } from 'vitest';
import {
  MAJOR_KEYS,
  MINOR_KEYS,
  diatonicDegrees,
} from '../keys';

// ---------------------------------------------------------------------------
// Task 1.2 — Example / unit tests for keys.ts
// ---------------------------------------------------------------------------

describe('MAJOR_KEYS / MINOR_KEYS pools (Requirements 6.1, 6.2)', () => {
  it('MAJOR_KEYS is the 15 canonical major tonics in order', () => {
    expect(MAJOR_KEYS).toEqual([
      'C',
      'G',
      'D',
      'A',
      'E',
      'B',
      'F#',
      'C#',
      'F',
      'Bb',
      'Eb',
      'Ab',
      'Db',
      'Gb',
      'Cb',
    ]);
    expect(MAJOR_KEYS).toHaveLength(15);
  });

  it('MINOR_KEYS is the 15 canonical minor tonics in order', () => {
    expect(MINOR_KEYS).toEqual([
      'A',
      'E',
      'B',
      'F#',
      'C#',
      'G#',
      'D#',
      'A#',
      'D',
      'G',
      'C',
      'F',
      'Bb',
      'Eb',
      'Ab',
    ]);
    expect(MINOR_KEYS).toHaveLength(15);
  });

  it('includes both sharp and flat keys (Requirement 6.3)', () => {
    expect(MAJOR_KEYS).toContain('F#');
    expect(MAJOR_KEYS).toContain('Bb');
    expect(MINOR_KEYS).toContain('G#');
    expect(MINOR_KEYS).toContain('Bb');
  });
});

describe('diatonicDegrees anchors (Requirements 5.1, 5.2, 5.3, 5.4, 5.5)', () => {
  it('C major spells the natural scale C D E F G A B', () => {
    expect(diatonicDegrees('C', 'major')).toEqual([
      'C',
      'D',
      'E',
      'F',
      'G',
      'A',
      'B',
    ]);
  });

  it('F# major degree 4 is B and degree 5 is C#', () => {
    const degrees = diatonicDegrees('F#', 'major');
    // index 0 = tonic (degree 1), so degree 4 = index 3, degree 5 = index 4.
    expect(degrees[3]).toBe('B');
    expect(degrees[4]).toBe('C#');
  });

  it('Eb major degree 5 is Bb', () => {
    const degrees = diatonicDegrees('Eb', 'major');
    expect(degrees[4]).toBe('Bb');
  });

  it('C# minor natural spelling is C# D# E F# G# A B (degree 7 = B)', () => {
    const degrees = diatonicDegrees('C#', 'minor');
    expect(degrees).toEqual([
      'C#',
      'D#',
      'E',
      'F#',
      'G#',
      'A',
      'B',
    ]);
    // Degree 7 (index 6) is the NATURAL minor 7th, B (not B#).
    expect(degrees[6]).toBe('B');
  });

  it('A minor natural spelling is A B C D E F G', () => {
    expect(diatonicDegrees('A', 'minor')).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
      'G',
    ]);
  });
});

describe('enharmonic distinctness (Requirement 5.6)', () => {
  it('C# major and Db major produce distinct spellings', () => {
    const cSharp = diatonicDegrees('C#', 'major');
    const dFlat = diatonicDegrees('Db', 'major');
    expect(cSharp).not.toEqual(dFlat);
  });
});
