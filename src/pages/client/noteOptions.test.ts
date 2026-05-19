import { describe, it, expect } from 'vitest';
import {
  NOTE_NAMES,
  SHARP_NOTES,
  FLAT_NOTES,
  interactiveAOptions,
  practiceOptions,
} from './noteOptions';

// Spec: options match the question's accidental class so the user is forced
// to identify the correct LETTER within a known class — not pick between
// mixed sharp/flat/natural spellings.
//   sharp question  → 7 sharps: C# D# E# F# G# A# B#
//   flat question   → 7 flats:  Cb Db Eb Fb Gb Ab Bb
//   natural / empty → 7 naturals: C D E F G A B
// Always 7, always contains the correct answer, always unique, in fixed
// letter order (C…B).

const NATURAL_SEVEN = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SHARP_SEVEN = ['C#', 'D#', 'E#', 'F#', 'G#', 'A#', 'B#'];
const FLAT_SEVEN = ['Cb', 'Db', 'Eb', 'Fb', 'Gb', 'Ab', 'Bb'];

describe('constants are well-formed', () => {
  it('NOTE_NAMES has the 7 natural letters', () => {
    expect(NOTE_NAMES).toEqual(NATURAL_SEVEN);
  });
  it('SHARP_NOTES has the 5 piano black-key sharp spellings', () => {
    expect(SHARP_NOTES).toEqual(['C#', 'D#', 'F#', 'G#', 'A#']);
  });
  it('FLAT_NOTES has the 5 piano black-key flat spellings', () => {
    expect(FLAT_NOTES).toEqual(['Db', 'Eb', 'Gb', 'Ab', 'Bb']);
  });
});

describe('interactiveAOptions (InteractiveQuiz A-type)', () => {
  it('natural question: returns the 7 naturals in C…B order', () => {
    expect(interactiveAOptions('C')).toEqual(NATURAL_SEVEN);
    expect(interactiveAOptions('F')).toEqual(NATURAL_SEVEN);
    expect(interactiveAOptions('B')).toEqual(NATURAL_SEVEN);
  });

  it('piano-black sharp question: returns the 7 sharps in C…B order', () => {
    expect(interactiveAOptions('C#')).toEqual(SHARP_SEVEN);
    expect(interactiveAOptions('F#')).toEqual(SHARP_SEVEN);
    expect(interactiveAOptions('A#')).toEqual(SHARP_SEVEN);
  });

  it('piano-black flat question: returns the 7 flats in C…B order', () => {
    expect(interactiveAOptions('Db')).toEqual(FLAT_SEVEN);
    expect(interactiveAOptions('Gb')).toEqual(FLAT_SEVEN);
    expect(interactiveAOptions('Bb')).toEqual(FLAT_SEVEN);
  });

  it('rare enharmonic sharps (E#/B#): still return the 7 sharps', () => {
    expect(interactiveAOptions('E#')).toEqual(SHARP_SEVEN);
    expect(interactiveAOptions('B#')).toEqual(SHARP_SEVEN);
  });

  it('rare enharmonic flats (Cb/Fb): still return the 7 flats', () => {
    expect(interactiveAOptions('Cb')).toEqual(FLAT_SEVEN);
    expect(interactiveAOptions('Fb')).toEqual(FLAT_SEVEN);
  });

  it('empty correct: falls back to the 7 naturals', () => {
    expect(interactiveAOptions('')).toEqual(NATURAL_SEVEN);
  });

  it('every result has exactly 7 unique entries containing the correct answer', () => {
    for (const correct of ['C', 'F#', 'Bb', 'E#', 'Cb', '']) {
      const opts = interactiveAOptions(correct);
      expect(opts).toHaveLength(7);
      expect(new Set(opts).size).toBe(7);
      if (correct) expect(opts).toContain(correct);
    }
  });
});

describe('practiceOptions (PracticeQuiz single-note options)', () => {
  it('natural correct: returns the 7 naturals', () => {
    expect(practiceOptions('C')).toEqual(NATURAL_SEVEN);
    expect(practiceOptions('A')).toEqual(NATURAL_SEVEN);
  });

  it('sharp correct: returns the 7 sharps', () => {
    expect(practiceOptions('C#')).toEqual(SHARP_SEVEN);
    expect(practiceOptions('G#')).toEqual(SHARP_SEVEN);
  });

  it('flat correct: returns the 7 flats', () => {
    expect(practiceOptions('Bb')).toEqual(FLAT_SEVEN);
    expect(practiceOptions('Eb')).toEqual(FLAT_SEVEN);
  });

  it('every result has exactly 7 unique entries containing the correct answer', () => {
    for (const correct of ['G', 'D#', 'Ab']) {
      const opts = practiceOptions(correct);
      expect(opts).toHaveLength(7);
      expect(new Set(opts).size).toBe(7);
      expect(opts).toContain(correct);
    }
  });
});
