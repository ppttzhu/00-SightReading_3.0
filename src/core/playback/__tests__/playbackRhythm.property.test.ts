/**
 * Rhythm-focused tests for the RCM Level 6 Playback generator. These lock in
 * the refactored rhythm engine (2-beat cell building blocks + a question-level
 * optional-dotted flag) without re-checking the melodic rules already covered
 * by playbackGenerator.property.test.ts.
 *
 * Covered:
 *   - structural correctness (beat totals, measure count/sizes, final note,
 *     ≤ 9 notes, no cell crossing a barline);
 *   - dotted-rhythm correctness (≤ 1 optional dotted quarter, the mandatory
 *     3/4 dotted half excluded, dotted cells intact within a measure, never
 *     silently removed);
 *   - statistical distribution over 10,000 seeded questions (~40% optional
 *     dotted, both dotted orderings appear in multiple positions, both meters
 *     stay varied) with the measured rates reported per meter.
 */

import { describe, it, expect } from 'vitest';

import { generateQuestion, validateQuestion } from '../playbackGenerator';
import { PLAYBACK_KEYS } from '../playbackTypes';
import type { PlaybackQuestion } from '../playbackTypes';

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Split a melody into measures using the beat sum and the meter's bar length. */
function splitMeasures(q: PlaybackQuestion): number[][] {
  const barBeats = q.meter === '3/4' ? 3 : 4;
  const measures: number[][] = [];
  let current: number[] = [];
  let acc = 0;
  for (const note of q.melody) {
    current.push(note.beats);
    acc += note.beats;
    if (acc >= barBeats - 1e-9) {
      measures.push(current);
      current = [];
      acc = 0;
    }
  }
  if (current.length > 0) measures.push(current);
  return measures;
}

/** Count OPTIONAL dotted quarters (1.5-beat notes) in the melody body. */
function optionalDottedCount(q: PlaybackQuestion): number {
  // The mandatory 3/4 final note is a dotted HALF (3 beats), not a 1.5-beat
  // dotted quarter, so counting 1.5-beat notes already excludes it.
  return q.melody.filter((n) => n.beats === 1.5).length;
}

const EVERY_SEED_COUNT = 500;

describe('Playback rhythm — structural correctness', () => {
  it('beats, measures, final note, and note count are always valid', () => {
    for (let seed = 0; seed < EVERY_SEED_COUNT; seed += 1) {
      const q = generateQuestion(PLAYBACK_KEYS, makeRng(seed));
      const total = q.melody.reduce((s, n) => s + n.beats, 0);
      const last = q.melody[q.melody.length - 1];

      expect(q.melody.length).toBeLessThanOrEqual(9);
      expect(q.melody.length).toBeGreaterThanOrEqual(1);

      if (q.meter === '4/4') {
        expect(total).toBeCloseTo(8, 6);
        expect(last.beats).toBe(2);
        expect(splitMeasures(q)).toHaveLength(2);
      } else {
        expect(total).toBeCloseTo(9, 6);
        expect(last.beats).toBe(3);
        expect(splitMeasures(q)).toHaveLength(3);
      }

      // Each measure sums to exactly the bar length — i.e. no cell crosses a
      // barline (if one did, a measure would be short or long).
      const barBeats = q.meter === '3/4' ? 3 : 4;
      for (const measure of splitMeasures(q)) {
        expect(measure.reduce((s, b) => s + b, 0)).toBeCloseTo(barBeats, 6);
      }
    }
  });

  it('3/4 final measure is exactly one dotted half (3 beats)', () => {
    for (let seed = 0; seed < EVERY_SEED_COUNT; seed += 1) {
      const q = generateQuestion(PLAYBACK_KEYS, makeRng(seed));
      if (q.meter !== '3/4') continue;
      const measures = splitMeasures(q);
      expect(measures[2]).toEqual([3]);
    }
  });
});

describe('Playback rhythm — dotted-rhythm correctness', () => {
  it('never contains more than one optional dotted quarter, and it stays intact', () => {
    for (let seed = 0; seed < 2000; seed += 1) {
      const q = generateQuestion(PLAYBACK_KEYS, makeRng(seed));
      expect(optionalDottedCount(q)).toBeLessThanOrEqual(1);

      // An optional dotted quarter is always paired with an eighth inside the
      // SAME measure (the cell is [1.5,0.5] or [0.5,1.5]); confirm it never sits
      // alone against a barline, which would mean the eighth was dropped.
      if (optionalDottedCount(q) === 1) {
        for (const measure of splitMeasures(q)) {
          if (measure.includes(1.5)) {
            expect(measure).toContain(0.5);
          }
        }
      }
    }
  });

  it('all generated questions pass validateQuestion()', () => {
    for (let seed = 0; seed < 2000; seed += 1) {
      expect(validateQuestion(generateQuestion(PLAYBACK_KEYS, makeRng(seed)))).toBe(true);
    }
  });
});

describe('Playback rhythm — statistical distribution (10,000 questions)', () => {
  it('≈40% contain one optional dotted quarter; both orderings appear in multiple positions', () => {
    const N = 10_000;
    const stats = {
      '3/4': { total: 0, dotted: 0, firstHalf: 0, firstEighth: 0, positions: new Set<number>() },
      '4/4': { total: 0, dotted: 0, firstHalf: 0, firstEighth: 0, positions: new Set<number>() },
    } as const;
    let overall = 0;

    for (let seed = 0; seed < N; seed += 1) {
      const q = generateQuestion(PLAYBACK_KEYS, makeRng(seed + 1));
      const bucket = stats[q.meter];
      bucket.total += 1;
      const beats = q.melody.map((n) => n.beats);
      const dottedIdx = beats.indexOf(1.5);
      if (dottedIdx >= 0) {
        overall += 1;
        bucket.dotted += 1;
        bucket.positions.add(dottedIdx);
        // [1.5, 0.5] (dotted first) vs [0.5, 1.5] (eighth first).
        if (beats[dottedIdx + 1] === 0.5) bucket.firstHalf += 1;
        else if (beats[dottedIdx - 1] === 0.5) bucket.firstEighth += 1;
      }
    }

    const pct = (a: number, b: number) => (b === 0 ? 0 : (100 * a) / b);
    console.log('\n=== DOTTED-RHYTHM DISTRIBUTION (10,000 questions) ===');
    console.log(`overall optional-dotted rate: ${pct(overall, N).toFixed(2)}%`);
    for (const meter of ['4/4', '3/4'] as const) {
      const b = stats[meter];
      console.log(
        `${meter}: n=${b.total} | dotted ${pct(b.dotted, b.total).toFixed(2)}% | ` +
        `[1.5,0.5] ${b.firstHalf} vs [0.5,1.5] ${b.firstEighth} | distinct positions ${b.positions.size}`,
      );
    }

    // Overall ~40% within ±3 percentage points.
    expect(pct(overall, N)).toBeGreaterThanOrEqual(37);
    expect(pct(overall, N)).toBeLessThanOrEqual(43);

    for (const meter of ['4/4', '3/4'] as const) {
      const b = stats[meter];
      expect(pct(b.dotted, b.total)).toBeGreaterThanOrEqual(37);
      expect(pct(b.dotted, b.total)).toBeLessThanOrEqual(43);
      // Both orderings occur, and the dotted quarter lands in >1 position.
      expect(b.firstHalf).toBeGreaterThan(0);
      expect(b.firstEighth).toBeGreaterThan(0);
      expect(b.firstHalf).toBeGreaterThan(b.firstEighth); // 60:40 favors dotted-first
      expect(b.positions.size).toBeGreaterThan(1);
    }
  });

  it('both meters produce varied rhythmic structures (not one repeated cell)', () => {
    const shapes: Record<'3/4' | '4/4', Set<string>> = { '3/4': new Set(), '4/4': new Set() };
    for (let seed = 0; seed < 3000; seed += 1) {
      const q = generateQuestion(PLAYBACK_KEYS, makeRng(seed + 7));
      shapes[q.meter].add(q.melody.map((n) => n.beats).join(','));
    }
    // Plenty of distinct rhythmic layouts in each meter.
    expect(shapes['4/4'].size).toBeGreaterThan(10);
    expect(shapes['3/4'].size).toBeGreaterThan(10);
  });
});
