import { describe, it, expect } from 'vitest';
import { mapKeyToNote, parseNoteKeys } from './keyboardInput';

describe('mapKeyToNote', () => {
  it('maps lowercase note letters to uppercase', () => {
    expect(mapKeyToNote('c')).toBe('C');
    expect(mapKeyToNote('d')).toBe('D');
    expect(mapKeyToNote('e')).toBe('E');
    expect(mapKeyToNote('f')).toBe('F');
    expect(mapKeyToNote('g')).toBe('G');
    expect(mapKeyToNote('a')).toBe('A');
    expect(mapKeyToNote('b')).toBe('B');
  });

  it('maps uppercase note letters as-is', () => {
    expect(mapKeyToNote('C')).toBe('C');
    expect(mapKeyToNote('B')).toBe('B');
  });

  it('returns null for non-note letters', () => {
    expect(mapKeyToNote('h')).toBeNull();
    expect(mapKeyToNote('x')).toBeNull();
    expect(mapKeyToNote('z')).toBeNull();
  });

  it('returns null for control keys', () => {
    expect(mapKeyToNote('Enter')).toBeNull();
    expect(mapKeyToNote('Escape')).toBeNull();
    expect(mapKeyToNote('ArrowLeft')).toBeNull();
    expect(mapKeyToNote('Shift')).toBeNull();
  });

  it('returns null for space and empty string', () => {
    expect(mapKeyToNote(' ')).toBeNull();
    expect(mapKeyToNote('')).toBeNull();
  });

  it('returns null for digits and punctuation', () => {
    expect(mapKeyToNote('1')).toBeNull();
    expect(mapKeyToNote('.')).toBeNull();
    expect(mapKeyToNote('/')).toBeNull();
  });
});

// ============================================================
// Sharp / Flat support — covers the bug that the keyboard input
// mode cannot distinguish accidentals.
//
// Design: parseNoteKeys takes a small buffer of recent keystrokes
// (collected within an accidental window) and resolves the final
// note name. This keeps the core logic pure / testable while the
// React event listener simply batches keys.
//
// Key conventions:
//   - Letters c/d/e/f/g/a/b (any case) → natural note letter.
//   - '#', '+', '=' → sharp modifier (multiple aliases for ergonomics).
//   - '-', '_'      → flat modifier  (NOT the letter 'b', which is
//                                      reserved for the B-natural note).
// ============================================================

describe('parseNoteKeys — natural notes', () => {
  it.each(['C', 'D', 'E', 'F', 'G', 'A', 'B'])(
    'resolves single letter %s to the same natural note',
    (letter) => {
      expect(parseNoteKeys([letter])).toBe(letter);
    },
  );

  it.each([
    ['c', 'C'],
    ['d', 'D'],
    ['e', 'E'],
    ['f', 'F'],
    ['g', 'G'],
    ['a', 'A'],
    ['b', 'B'],
  ])('uppercases lowercase letter %s → %s', (input, expected) => {
    expect(parseNoteKeys([input])).toBe(expected);
  });
});

describe('parseNoteKeys — sharps', () => {
  it.each([
    ['C', 'C#'],
    ['D', 'D#'],
    ['E', 'E#'],
    ['F', 'F#'],
    ['G', 'G#'],
    ['A', 'A#'],
    ['B', 'B#'],
  ])('letter %s followed by # resolves to %s', (letter, expected) => {
    expect(parseNoteKeys([letter, '#'])).toBe(expected);
  });

  it.each(['#', '+', '='])('treats %s as a sharp alias', (alias) => {
    expect(parseNoteKeys(['C', alias])).toBe('C#');
  });

  it('also accepts modifier-first order (# before letter)', () => {
    expect(parseNoteKeys(['#', 'C'])).toBe('C#');
    expect(parseNoteKeys(['+', 'F'])).toBe('F#');
  });

  it('uppercases lowercase letter when combined with sharp', () => {
    expect(parseNoteKeys(['f', '#'])).toBe('F#');
  });
});

describe('parseNoteKeys — flats', () => {
  it.each([
    ['C', 'Cb'],
    ['D', 'Db'],
    ['E', 'Eb'],
    ['F', 'Fb'],
    ['G', 'Gb'],
    ['A', 'Ab'],
    ['B', 'Bb'],
  ])('letter %s followed by - resolves to flat %s', (letter, expected) => {
    expect(parseNoteKeys([letter, '-'])).toBe(expected);
  });

  it.each(['-', '_'])('treats %s as a flat alias', (alias) => {
    expect(parseNoteKeys(['B', alias])).toBe('Bb');
  });

  it('also accepts modifier-first order (- before letter)', () => {
    expect(parseNoteKeys(['-', 'B'])).toBe('Bb');
    expect(parseNoteKeys(['_', 'E'])).toBe('Eb');
  });

  it('treats lone "b" as the B-natural letter', () => {
    expect(parseNoteKeys(['b'])).toBe('B');
    expect(parseNoteKeys(['B'])).toBe('B');
  });

  it('treats "b" after another letter as a flat modifier', () => {
    expect(parseNoteKeys(['C', 'b'])).toBe('Cb');
    expect(parseNoteKeys(['D', 'b'])).toBe('Db');
    expect(parseNoteKeys(['E', 'b'])).toBe('Eb');
    expect(parseNoteKeys(['A', 'b'])).toBe('Ab');
  });

  it('treats "b" after another "b" as flat-of-B (e.g. Bb)', () => {
    // First b establishes letter B; second b flattens it.
    expect(parseNoteKeys(['b', 'b'])).toBe('Bb');
    expect(parseNoteKeys(['B', 'b'])).toBe('Bb');
  });

  it('treats "b" followed by a different letter as that letter (b becomes B then is overridden)', () => {
    // ['b', 'd'] → b is the first letter (B), then d overrides letter to D.
    expect(parseNoteKeys(['b', 'd'])).toBe('D');
  });
});

describe('parseNoteKeys — corner cases', () => {
  it('returns null for an empty sequence', () => {
    expect(parseNoteKeys([])).toBeNull();
  });

  it.each(['#', '+', '=', '-', '_'])(
    'returns null for a lone accidental key %s with no letter',
    (k) => {
      expect(parseNoteKeys([k])).toBeNull();
    },
  );

  it('returns null when only accidentals are present', () => {
    expect(parseNoteKeys(['#', '-'])).toBeNull();
    expect(parseNoteKeys(['+', '=', '_'])).toBeNull();
  });

  it.each(['h', 'x', 'z', '1', '.', '/', ' '])(
    'returns null when the only key %s is not a note letter',
    (k) => {
      expect(parseNoteKeys([k])).toBeNull();
    },
  );

  it('ignores unrelated keys but still resolves the note', () => {
    expect(parseNoteKeys(['Enter', 'C', '#'])).toBe('C#');
    expect(parseNoteKeys(['Shift', 'A', '-'])).toBe('Ab');
  });

  it('returns null when no letter is present even with junk keys', () => {
    expect(parseNoteKeys(['Enter', '#', 'Shift'])).toBeNull();
  });

  it('uses the last letter when multiple letters are pressed', () => {
    expect(parseNoteKeys(['C', 'D'])).toBe('D');
    expect(parseNoteKeys(['C', 'D', '#'])).toBe('D#');
    expect(parseNoteKeys(['#', 'C', 'D'])).toBe('D#');
  });

  it('uses the last accidental when conflicting modifiers are pressed', () => {
    expect(parseNoteKeys(['C', '#', '-'])).toBe('Cb');
    expect(parseNoteKeys(['C', '-', '#'])).toBe('C#');
  });

  it('uses the last accidental even across letters', () => {
    expect(parseNoteKeys(['C', '#', 'D', '-'])).toBe('Db');
  });

  it('returns null for control keys like Enter / Escape / ArrowLeft', () => {
    expect(parseNoteKeys(['Enter'])).toBeNull();
    expect(parseNoteKeys(['Escape'])).toBeNull();
    expect(parseNoteKeys(['ArrowLeft'])).toBeNull();
  });

  it('ignores empty-string entries in the sequence', () => {
    expect(parseNoteKeys(['', 'C', ''])).toBe('C');
    expect(parseNoteKeys(['', '#', 'C'])).toBe('C#');
  });
});
