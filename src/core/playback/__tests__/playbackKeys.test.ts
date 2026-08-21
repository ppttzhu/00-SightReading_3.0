import { describe, it, expect } from 'vitest';
import { degreeToPitch, raisedLeadingTone, tonicChord, keyInfo } from '../playbackKeys';

describe('degreeToPitch (diatonic, key-correct spelling)', () => {
  it('G major scale', () => {
    const degs = [1, 2, 3, 4, 5, 6, 7, 8].map((d) => degreeToPitch('G major', d, 4));
    expect(degs).toEqual(['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G5']);
  });
  it('E major scale (4 sharps)', () => {
    const degs = [1, 2, 3, 4, 5, 6, 7, 8].map((d) => degreeToPitch('E major', d, 4));
    expect(degs).toEqual(['E4', 'F#4', 'G#4', 'A4', 'B4', 'C#5', 'D#5', 'E5']);
  });
  it('G minor natural scale (2 flats)', () => {
    const degs = [1, 2, 3, 4, 5, 6, 7].map((d) => degreeToPitch('G minor', d, 4));
    expect(degs).toEqual(['G4', 'A4', 'Bb4', 'C5', 'D5', 'Eb5', 'F5']);
  });
  it('E minor natural scale (1 sharp)', () => {
    const degs = [1, 2, 3, 4, 5, 6, 7].map((d) => degreeToPitch('E minor', d, 4));
    expect(degs).toEqual(['E4', 'F#4', 'G4', 'A4', 'B4', 'C5', 'D5']);
  });
});

describe('raisedLeadingTone', () => {
  it('raises the natural 7th to the leading tone', () => {
    expect(raisedLeadingTone('G minor', 4)).toBe('F#5'); // natural F5 -> F#5
    expect(raisedLeadingTone('E minor', 4)).toBe('D#5'); // natural D5 -> D#5
    expect(raisedLeadingTone('G major', 4)).toBe('F##5'); // already F#, raise to F##
  });
});

describe('tonicChord', () => {
  it('matches the RCM §14 voicings', () => {
    expect(tonicChord('G major')).toEqual(['G4', 'B4', 'D5', 'G5']);
    expect(tonicChord('E major')).toEqual(['E4', 'G#4', 'B4', 'E5']);
    expect(tonicChord('G minor')).toEqual(['G4', 'Bb4', 'D5', 'G5']);
    expect(tonicChord('E minor')).toEqual(['E4', 'G4', 'B4', 'E5']);
  });
});

describe('keyInfo VexFlow specs', () => {
  it('uses major/minor key specs', () => {
    expect(keyInfo('G major').vexKeySpec).toBe('G');
    expect(keyInfo('E minor').vexKeySpec).toBe('Em');
  });
});
