/**
 * Beat-aware eighth-note beaming tests (spec §6/§12). These lock in that the
 * notation groups eighths by their metric beat — the fix for the awkward
 * three-eighth beam the generator could previously produce, e.g.
 * `[1.5, 0.5, 0.5, 0.5, 1]`.
 *
 * `beamIndexGroups` returns runs of note indices; the renderer beams only runs
 * of length ≥ 2, so a length-1 run means "isolated eighth → flag, no beam".
 */

import { describe, it, expect } from 'vitest';

import { beamIndexGroups } from '../beaming';

/** Beamed runs only (length ≥ 2), matching how the renderer filters groups. */
function beamedRuns(measureBeats: number[]): number[][] {
  return beamIndexGroups(measureBeats).filter((g) => g.length >= 2);
}

describe('beamIndexGroups — metric eighth beaming', () => {
  it('beams the two eighths of a single beat together', () => {
    expect(beamIndexGroups([0.5, 0.5, 1, 1])).toEqual([[0, 1]]);
  });

  it('does NOT merge three consecutive eighths across a beat boundary', () => {
    // dotted-q(0..1.5), eighth@1.5, eighth@2.0, eighth@2.5, quarter@3.0.
    // The eighth on beat-2's upbeat (index 1) is alone; the two eighths in
    // beat 3 (indices 2,3) beam together. Never a 3-eighth beam.
    expect(beamIndexGroups([1.5, 0.5, 0.5, 0.5, 1])).toEqual([[1], [2, 3]]);
    expect(beamedRuns([1.5, 0.5, 0.5, 0.5, 1])).toEqual([[2, 3]]);
  });

  it('splits a run of four eighths at the beat boundary (two beamed pairs)', () => {
    expect(beamIndexGroups([0.5, 0.5, 0.5, 0.5, 2])).toEqual([[0, 1], [2, 3]]);
  });

  it('leaves an isolated eighth unbeamed (flagged)', () => {
    expect(beamIndexGroups([1, 0.5, 1.5, 1])).toEqual([[1]]);
    expect(beamedRuns([1, 0.5, 1.5, 1])).toEqual([]);
  });

  it('handles a measure with no eighths (no beams)', () => {
    expect(beamIndexGroups([1, 1, 1, 1])).toEqual([]);
    expect(beamIndexGroups([2, 2])).toEqual([]);
  });

  it('3/4: eighths within a beat beam, beats stay separate (not 6/8 grouping)', () => {
    expect(beamIndexGroups([1, 0.5, 0.5, 1])).toEqual([[1, 2]]);
    // A full bar of eighths in 3/4 beams as three per-beat pairs, never two
    // 6/8-style groups of three.
    expect(beamIndexGroups([0.5, 0.5, 0.5, 0.5, 0.5, 0.5])).toEqual([[0, 1], [2, 3], [4, 5]]);
  });

  it('eighth-first dotted cell: the on-beat eighth is not beamed to the next beat', () => {
    // [0.5, 1.5, 2] → eighth@0 alone, dotted-q@0.5 spans into beat 1.
    expect(beamedRuns([0.5, 1.5, 2])).toEqual([]);
  });
});
