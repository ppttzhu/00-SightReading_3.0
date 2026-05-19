// Option lists for single-note (A-type) answer UI. Options match the
// question's accidental class so the user identifies the LETTER within a
// known class — rather than picking between mixed sharp/flat/natural spellings.
//   sharp pitch  → 7 sharps: C# D# E# F# G# A# B#  (includes E#, B#)
//   flat pitch   → 7 flats:  Cb Db Eb Fb Gb Ab Bb  (includes Cb, Fb)
//   natural / empty → 7 naturals: C D E F G A B
// Always 7, contains the correct answer, all unique, in fixed C…B order.

export const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const SHARP_NOTES = ['C#', 'D#', 'F#', 'G#', 'A#'];
export const FLAT_NOTES = ['Db', 'Eb', 'Gb', 'Ab', 'Bb'];

function classFromCorrect(correct: string): '#' | 'b' | '' {
  if (correct.endsWith('#')) return '#';
  if (correct.endsWith('b')) return 'b';
  return '';
}

function sevenInClass(accidental: '#' | 'b' | ''): string[] {
  return NOTE_NAMES.map(letter => `${letter}${accidental}`);
}

export function interactiveAOptions(correct: string): string[] {
  return sevenInClass(classFromCorrect(correct));
}

export function practiceOptions(correct: string): string[] {
  return sevenInClass(classFromCorrect(correct));
}
