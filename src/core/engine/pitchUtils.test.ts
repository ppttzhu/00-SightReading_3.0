import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  getClefForPitches,
  pitchEqual,
} from './pitchUtils';

// pitchEqual compares two pitch strings (letter[+#|b]octave, e.g. "C4", "C#4",
// "Db4") and is true iff:
//   - both parse as a valid pitch (letter + optional accidental + integer octave)
//   - octaves match exactly
//   - letter+accidental are equal OR enharmonic equivalents in the same octave
// Five enharmonic pairs are recognized: C#↔Db, D#↔Eb, F#↔Gb, G#↔Ab, A#↔Bb.
// Rare cross-octave spellings (B#/Cb, E#/Fb) are intentionally NOT treated as
// enharmonic — they don't appear in our question/answer vocabulary.

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pitchEqual — natural pitches', () => {
  it('returns true for identical pitches', () => {
    expect(pitchEqual('C4', 'C4')).toBe(true);
    expect(pitchEqual('A0', 'A0')).toBe(true);
    expect(pitchEqual('C8', 'C8')).toBe(true);
  });

  it('returns false when only the letter matches but the octave differs', () => {
    expect(pitchEqual('C4', 'C5')).toBe(false);
    expect(pitchEqual('C5', 'C4')).toBe(false);
    expect(pitchEqual('A2', 'A7')).toBe(false);
  });

  it('returns false for different natural letters in the same octave', () => {
    expect(pitchEqual('C4', 'D4')).toBe(false);
    expect(pitchEqual('E4', 'F4')).toBe(false);
  });
});

describe('pitchEqual — accidentals', () => {
  it('returns true for identical accidental spellings', () => {
    expect(pitchEqual('C#4', 'C#4')).toBe(true);
    expect(pitchEqual('Bb3', 'Bb3')).toBe(true);
  });

  it.each([
    ['C#', 'Db'],
    ['D#', 'Eb'],
    ['F#', 'Gb'],
    ['G#', 'Ab'],
    ['A#', 'Bb'],
  ])('treats %s and %s as enharmonic in the same octave', (sharp, flat) => {
    expect(pitchEqual(`${sharp}4`, `${flat}4`)).toBe(true);
    expect(pitchEqual(`${flat}4`, `${sharp}4`)).toBe(true);
  });

  it('returns false for enharmonic letters across different octaves', () => {
    expect(pitchEqual('C#4', 'Db5')).toBe(false);
    expect(pitchEqual('A#3', 'Bb2')).toBe(false);
  });

  it('returns false when one side has an accidental and the other does not', () => {
    expect(pitchEqual('C#4', 'C4')).toBe(false);
    expect(pitchEqual('C4', 'C#4')).toBe(false);
    expect(pitchEqual('Bb3', 'B3')).toBe(false);
  });

  it('does not treat B#/Cb or E#/Fb as enharmonic (out of our vocabulary)', () => {
    expect(pitchEqual('B#3', 'C4')).toBe(false);
    expect(pitchEqual('Cb4', 'B3')).toBe(false);
    expect(pitchEqual('E#4', 'F4')).toBe(false);
    expect(pitchEqual('Fb4', 'E4')).toBe(false);
  });
});

describe('pitchEqual — invalid input', () => {
  it('returns false when either side is empty', () => {
    expect(pitchEqual('', 'C4')).toBe(false);
    expect(pitchEqual('C4', '')).toBe(false);
    expect(pitchEqual('', '')).toBe(false);
  });

  it('returns false when one side is just a letter without an octave', () => {
    expect(pitchEqual('C', 'C4')).toBe(false);
    expect(pitchEqual('C4', 'C')).toBe(false);
    expect(pitchEqual('C#', 'C#4')).toBe(false);
  });

  it('returns false for unparsable junk', () => {
    expect(pitchEqual('?', 'C4')).toBe(false);
    expect(pitchEqual('C4', 'foo')).toBe(false);
    expect(pitchEqual('H4', 'C4')).toBe(false); // H is not a note letter
  });

  it('handles multi-digit octaves correctly (e.g. C10 should not be C1)', () => {
    expect(pitchEqual('C10', 'C1')).toBe(false);
    expect(pitchEqual('C10', 'C10')).toBe(true);
  });
});

describe('automatic clef selection', () => {
  it('forces bass for pitches lower than G3', () => {
    expect(getClefForPitches('F3')).toBe('bass');
    expect(getClefForPitches('F#3')).toBe('bass');
  });

  it('forces treble for pitches higher than F4', () => {
    expect(getClefForPitches('F#4')).toBe('treble');
    expect(getClefForPitches('G4')).toBe('treble');
  });

  it('uses the full note group when choosing a clef for intervals or chords', () => {
    expect(getClefForPitches(['C4', 'F3'])).toBe('bass');
    expect(getClefForPitches(['D4', 'G4'])).toBe('treble');
  });
});

describe('practice clef selection', () => {
  it('does not choose treble-only for pitches lower than G3', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.75);
    expect(getClefForPitches('F3', { allowGrand: true })).toBe('bass');

    vi.spyOn(Math, 'random').mockReturnValue(0.25);
    expect(getClefForPitches('F3', { allowGrand: true })).toBe('grand');
  });

  it('can use grand for pitches higher than F4', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.75);
    expect(getClefForPitches('G4', { allowGrand: true })).toBe('treble');

    vi.spyOn(Math, 'random').mockReturnValue(0.25);
    expect(getClefForPitches('G4', { allowGrand: true })).toBe('grand');
  });

  it('uses grand when a pitch group crosses both forced ranges', () => {
    expect(getClefForPitches(['F3', 'G4'], { allowGrand: true })).toBe('grand');
  });
});
