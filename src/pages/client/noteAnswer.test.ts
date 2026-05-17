import { describe, it, expect } from 'vitest';
import { extractNoteAnswer, enharmonicEqual } from './noteAnswer';

// The canonical note answer for an A-type quiz must preserve the accidental
// (# or b) so sharp/flat questions can be distinguished from naturals.
describe('extractNoteAnswer — A-type correct answer extraction', () => {
  it('returns just the letter for natural pitches', () => {
    expect(extractNoteAnswer('C4')).toBe('C');
    expect(extractNoteAnswer('A5')).toBe('A');
    expect(extractNoteAnswer('G3')).toBe('G');
  });

  it('preserves the sharp accidental', () => {
    expect(extractNoteAnswer('C#4')).toBe('C#');
    expect(extractNoteAnswer('F#5')).toBe('F#');
    expect(extractNoteAnswer('G#3')).toBe('G#');
  });

  it('preserves the flat accidental', () => {
    expect(extractNoteAnswer('Bb4')).toBe('Bb');
    expect(extractNoteAnswer('Eb3')).toBe('Eb');
    expect(extractNoteAnswer('Ab5')).toBe('Ab');
  });

  it('uppercases the letter while keeping the accidental case', () => {
    expect(extractNoteAnswer('c4')).toBe('C');
    expect(extractNoteAnswer('c#4')).toBe('C#');
    expect(extractNoteAnswer('eb3')).toBe('Eb');
  });

  it('returns empty string for empty / malformed input', () => {
    expect(extractNoteAnswer('')).toBe('');
    expect(extractNoteAnswer('?')).toBe('');
  });
});

describe('enharmonicEqual — sharp/flat equivalence for piano keyboard', () => {
  it.each([
    ['C#', 'Db'], ['D#', 'Eb'], ['F#', 'Gb'], ['G#', 'Ab'], ['A#', 'Bb'],
  ])('treats %s and %s as the same pitch', (a, b) => {
    expect(enharmonicEqual(a, b)).toBe(true);
    expect(enharmonicEqual(b, a)).toBe(true);
  });

  it('treats identical inputs as equal', () => {
    expect(enharmonicEqual('C', 'C')).toBe(true);
    expect(enharmonicEqual('C#', 'C#')).toBe(true);
    expect(enharmonicEqual('Db', 'Db')).toBe(true);
  });

  it('rejects non-enharmonic mismatches', () => {
    expect(enharmonicEqual('C', 'D')).toBe(false);
    expect(enharmonicEqual('C', 'C#')).toBe(false);
    expect(enharmonicEqual('E', 'F')).toBe(false);   // not enharmonic in this app's vocabulary
    expect(enharmonicEqual('B', 'Cb')).toBe(false);  // Cb not in our answer set
  });
});
