import { describe, it, expect } from 'vitest';
import { pitchClassOf, targetSequence, evaluateSequence } from '../melodyMatch';

describe('pitchClassOf / targetSequence', () => {
  it('computes octave-agnostic pitch classes', () => {
    expect(pitchClassOf('C4')).toBe(0);
    expect(pitchClassOf('C5')).toBe(0);
    expect(pitchClassOf('F#4')).toBe(6);
    expect(pitchClassOf('Gb4')).toBe(6); // enharmonic equal
    expect(pitchClassOf('Bb3')).toBe(10);
  });

  it('maps a melody to its pitch-class sequence', () => {
    expect(targetSequence([{ pitch: 'G4', beats: 1 }, { pitch: 'A4', beats: 1 }, { pitch: 'B4', beats: 1 }]))
      .toEqual([7, 9, 11]);
  });
});

describe('evaluateSequence (octave-agnostic, positional)', () => {
  const target = [7, 9, 11]; // G A B

  it('reports in-progress for a correct partial prefix', () => {
    expect(evaluateSequence([7], target)).toEqual({ matchedCount: 1, status: 'in-progress' });
    expect(evaluateSequence([7, 9], target)).toEqual({ matchedCount: 2, status: 'in-progress' });
  });

  it('reports complete for the full correct sequence (any octave)', () => {
    expect(evaluateSequence([7, 9, 11], target)).toEqual({ matchedCount: 3, status: 'complete' });
  });

  it('reports wrong on the first mismatch', () => {
    expect(evaluateSequence([7, 10], target)).toEqual({ matchedCount: 1, status: 'wrong' });
  });

  it('reports wrong when extra notes are played past the end', () => {
    expect(evaluateSequence([7, 9, 11, 0], target)).toEqual({ matchedCount: 3, status: 'wrong' });
  });
});
