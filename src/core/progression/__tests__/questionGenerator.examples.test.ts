/**
 * Example-based unit tests for full Level 6 progressions (task 4.5).
 *
 * These anchors verify the three-chord ASCENDING-BASS voicing deterministically
 * by resolving each progression's Chord_Specs with `resolveProgression` in a
 * fixed Key/Mode — exactly what the Question_Generator does. The pitch arrays
 * (with octaves) are compared against the concrete voicing from the
 * requirements/spec §2 table, and the bass line is asserted to ascend
 * (tonic → middle above tonic → upper tonic).
 */

import { describe, it, expect } from 'vitest';

import { CHORD_SPECS } from '../progressions';
import { resolveProgression } from '../chordResolver';

/** Resolve a progression's specs in a Key/Mode to per-chord pitch arrays (with octaves). */
function voiceProgression(
  key: string,
  mode: 'major' | 'minor',
  specs: (typeof CHORD_SPECS)[keyof typeof CHORD_SPECS][],
): string[][] {
  return resolveProgression(key, mode, specs).map((c) => c.pitches);
}

/** Assert the bass line ascends: bass[0] < bass[1] < bass[2] and bass[2] === bass[0] + 12. */
function expectAscendingBass(key: string, mode: 'major' | 'minor', specs: (typeof CHORD_SPECS)[keyof typeof CHORD_SPECS][]) {
  const bass = resolveProgression(key, mode, specs).map((c) => c.midis[0]);
  expect(bass[0]).toBeLessThan(bass[1]);
  expect(bass[1]).toBeLessThan(bass[2]);
  expect(bass[2]).toBe(bass[0] + 12);
}

describe('full progressions — ascending-bass voicing (Requirements 2.4, 2.5, 2.6, 2.7, 15.5, 15.6)', () => {
  it('C major I–V–I = C4-E4-G4 → G4-B4-D5 → C5-E5-G5', () => {
    const specs = [CHORD_SPECS.I, CHORD_SPECS.V, CHORD_SPECS.I];
    expect(voiceProgression('C', 'major', specs)).toEqual([
      ['C4', 'E4', 'G4'],
      ['G4', 'B4', 'D5'],
      ['C5', 'E5', 'G5'],
    ]);
    expectAscendingBass('C', 'major', specs);
  });

  it('C major I–IV–I = C4-E4-G4 → F4-A4-C5 → C5-E5-G5', () => {
    const specs = [CHORD_SPECS.I, CHORD_SPECS.IV, CHORD_SPECS.I];
    expect(voiceProgression('C', 'major', specs)).toEqual([
      ['C4', 'E4', 'G4'],
      ['F4', 'A4', 'C5'],
      ['C5', 'E5', 'G5'],
    ]);
    expectAscendingBass('C', 'major', specs);
  });

  it('C minor i–iv–i = C4-Eb4-G4 → F4-Ab4-C5 → C5-Eb5-G5', () => {
    const specs = [CHORD_SPECS.i, CHORD_SPECS.iv, CHORD_SPECS.i];
    expect(voiceProgression('C', 'minor', specs)).toEqual([
      ['C4', 'Eb4', 'G4'],
      ['F4', 'Ab4', 'C5'],
      ['C5', 'Eb5', 'G5'],
    ]);
    expectAscendingBass('C', 'minor', specs);
  });

  it('A minor i–V–i = A4-C5-E5 → E5-G#5-B5 → A5-C6-E6 (raised leading tone, ascending bass)', () => {
    const specs = [CHORD_SPECS.i, CHORD_SPECS.V, CHORD_SPECS.i];
    expect(voiceProgression('A', 'minor', specs)).toEqual([
      ['A4', 'C5', 'E5'],
      ['E5', 'G#5', 'B5'],
      ['A5', 'C6', 'E6'],
    ]);
    expectAscendingBass('A', 'minor', specs);
  });
});
