/**
 * Property-based tests for the RCM Level 6 Playback generator. These enforce the
 * HARD syllabus rules from rule.md across many seeds: supported keys, meters,
 * melody length, allowed starting/ending degrees, measure-beat math, supported
 * rhythmic values, and bank-uniqueness.
 */

import fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { generateQuestion, validateQuestion } from '../playbackGenerator';
import { PLAYBACK_KEYS } from '../playbackTypes';
import { keyInfo, pitchToMidi } from '../playbackKeys';
import { PLAYBACK_BANK } from '../playbackBank';
import { targetSequence } from '../melodyMatch';

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

const seedArb = fc.integer({ min: 0, max: 2 ** 31 - 1 });
const SUPPORTED_BEATS = new Set([0.5, 1, 1.5, 2, 3, 4]);
const BANK_SEQS = new Set(PLAYBACK_BANK.map((q) => targetSequence(q.melody).join(',')));

/** Semitones of a pitch above the key's tonic pitch class. */
function endSemis(key: (typeof PLAYBACK_KEYS)[number], pitch: string): number {
  const tonicPc = ((pitchToMidi(`${keyInfo(key).tonicLetter}4`) % 12) + 12) % 12;
  const pc = ((pitchToMidi(pitch) % 12) + 12) % 12;
  return ((pc - tonicPc) + 12) % 12;
}

describe('Playback generator hard rules', () => {
  it('every generated question passes the validator', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        expect(validateQuestion(generateQuestion(PLAYBACK_KEYS, makeRng(seed)))).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('key ∈ 4 supported, meter ∈ {3/4,4/4}, ≤9 notes, supported rhythmic values', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const q = generateQuestion(PLAYBACK_KEYS, makeRng(seed));
        expect(PLAYBACK_KEYS).toContain(q.key);
        expect(['3/4', '4/4']).toContain(q.meter);
        expect(q.melody.length).toBeGreaterThanOrEqual(1);
        expect(q.melody.length).toBeLessThanOrEqual(9);
        for (const n of q.melody) expect(SUPPORTED_BEATS.has(n.beats)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('measure beats sum correctly (3/4 → 9 total, 4/4 → 8 total) with a sustained final note', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const q = generateQuestion(PLAYBACK_KEYS, makeRng(seed));
        const total = q.melody.reduce((s, n) => s + n.beats, 0);
        expect(total).toBeCloseTo(q.meter === '3/4' ? 9 : 8, 5);
        const last = q.melody[q.melody.length - 1];
        if (q.meter === '3/4') expect(last.beats).toBe(3);
        else expect(last.beats).toBeGreaterThanOrEqual(2);
      }),
      { numRuns: 200 },
    );
  });

  it('3/4 final measure is exactly one dotted-half (beats 3); M1+M2 fill the first 6 beats', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const q = generateQuestion(PLAYBACK_KEYS, makeRng(seed));
        fc.pre(q.meter === '3/4');
        // beats:3 is a DOTTED HALF (fills a full 3/4 measure), never a plain half.
        expect(q.melody[q.melody.length - 1].beats).toBe(3);
        const body = q.melody.slice(0, -1).reduce((s, n) => s + n.beats, 0);
        expect(body).toBeCloseTo(6, 5);
      }),
      { numRuns: 200 },
    );
  });

  it('ends on a stable scale degree (tonic, mediant, or dominant)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const q = generateQuestion(PLAYBACK_KEYS, makeRng(seed));
        const semis = endSemis(q.key, q.melody[q.melody.length - 1].pitch);
        expect([0, 3, 4, 7]).toContain(semis);
      }),
      { numRuns: 200 },
    );
  });

  it('is never identical to a bank melody', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const q = generateQuestion(PLAYBACK_KEYS, makeRng(seed));
        expect(BANK_SEQS.has(targetSequence(q.melody).join(','))).toBe(false);
      }),
      { numRuns: 200 },
    );
  });

  it('honors the selected key pool', () => {
    fc.assert(
      fc.property(seedArb, fc.subarray([...PLAYBACK_KEYS], { minLength: 1 }), (seed, keys) => {
        const q = generateQuestion(keys, makeRng(seed));
        expect(keys).toContain(q.key);
      }),
      { numRuns: 100 },
    );
  });
});

describe('validateQuestion rejects malformed questions', () => {
  it('rejects >9 notes', () => {
    const melody = Array.from({ length: 10 }, () => ({ pitch: 'G4', beats: 1 }));
    expect(validateQuestion({ id: 'x', key: 'G major', meter: '4/4', tonic: [], melody })).toBe(false);
  });
  it('rejects wrong beat totals', () => {
    expect(validateQuestion({ id: 'x', key: 'G major', meter: '4/4', tonic: [], melody: [{ pitch: 'G4', beats: 1 }] })).toBe(false);
  });
});
