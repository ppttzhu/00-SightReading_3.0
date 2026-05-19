import { describe, it, expect } from 'vitest';
import {
  NOTE_NAMES,
  SHARP_NOTES,
  FLAT_NOTES,
  interactiveAOptions,
  practiceOptions,
} from './noteOptions';

// Both InteractiveQuiz A-type and PracticeQuiz single-note answers must show
// exactly 7 unique options in options mode, always including the correct
// answer. PR #3 originally regressed this to 4 (correct + 3 distractors); a
// later patch overshot to 12 / 17 when accidentals were in the pool. These
// tests pin the final contract: length 7, contains correct, no duplicates.

const OPTION_COUNT = 7;
const FULL_POOL = [...NOTE_NAMES, ...SHARP_NOTES, ...FLAT_NOTES];

function assertSevenUniqueContaining(opts: string[], correct: string, allowed: string[]) {
  expect(opts).toHaveLength(OPTION_COUNT);
  expect(opts).toContain(correct);
  expect(new Set(opts).size).toBe(OPTION_COUNT);
  for (const opt of opts) {
    expect(allowed).toContain(opt);
  }
}

describe('constants are well-formed', () => {
  it('NOTE_NAMES has the 7 natural letters', () => {
    expect(NOTE_NAMES).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
  });
  it('SHARP_NOTES has the 5 piano black-key sharp spellings', () => {
    expect(SHARP_NOTES).toEqual(['C#', 'D#', 'F#', 'G#', 'A#']);
  });
  it('FLAT_NOTES has the 5 piano black-key flat spellings', () => {
    expect(FLAT_NOTES).toEqual(['Db', 'Eb', 'Gb', 'Ab', 'Bb']);
  });
});

describe('interactiveAOptions (InteractiveQuiz A-type)', () => {
  it('natural question: returns the 7 naturals in fixed order', () => {
    expect(interactiveAOptions('C')).toEqual(NOTE_NAMES);
    expect(interactiveAOptions('B')).toEqual(NOTE_NAMES);
  });

  it('sharp question: 7 unique options, contains the sharp answer', () => {
    for (let i = 0; i < 50; i++) {
      assertSevenUniqueContaining(interactiveAOptions('C#'), 'C#', FULL_POOL);
    }
  });

  it('flat question: 7 unique options, contains the flat answer', () => {
    for (let i = 0; i < 50; i++) {
      assertSevenUniqueContaining(interactiveAOptions('Bb'), 'Bb', FULL_POOL);
    }
  });

  it('empty correct (edge case): falls back to the 7 naturals', () => {
    expect(interactiveAOptions('')).toEqual(NOTE_NAMES);
  });
});

describe('practiceOptions (PracticeQuiz toggle-driven options)', () => {
  it('both toggles off: returns the 7 naturals in fixed order', () => {
    expect(practiceOptions('C', false, false)).toEqual(NOTE_NAMES);
    expect(practiceOptions('G', false, false)).toEqual(NOTE_NAMES);
  });

  it('sharps only, natural correct: 7 unique from naturals+sharps, contains correct', () => {
    const allowed = [...NOTE_NAMES, ...SHARP_NOTES];
    for (let i = 0; i < 50; i++) {
      assertSevenUniqueContaining(practiceOptions('C', true, false), 'C', allowed);
    }
  });

  it('sharps only, sharp correct: 7 unique, contains the sharp answer, no flats', () => {
    const allowed = [...NOTE_NAMES, ...SHARP_NOTES];
    for (let i = 0; i < 50; i++) {
      const opts = practiceOptions('F#', true, false);
      assertSevenUniqueContaining(opts, 'F#', allowed);
      expect(opts).not.toContain('Gb');
    }
  });

  it('flats only, flat correct: 7 unique, contains the flat answer, no sharps', () => {
    const allowed = [...NOTE_NAMES, ...FLAT_NOTES];
    for (let i = 0; i < 50; i++) {
      const opts = practiceOptions('Bb', false, true);
      assertSevenUniqueContaining(opts, 'Bb', allowed);
      expect(opts).not.toContain('A#');
    }
  });

  it('both toggles on, accidental correct: 7 unique from the full 17-pool', () => {
    for (let i = 0; i < 50; i++) {
      assertSevenUniqueContaining(practiceOptions('Eb', true, true), 'Eb', FULL_POOL);
    }
  });

  it('both toggles on, natural correct: 7 unique from the full 17-pool', () => {
    for (let i = 0; i < 50; i++) {
      assertSevenUniqueContaining(practiceOptions('G', true, true), 'G', FULL_POOL);
    }
  });
});
