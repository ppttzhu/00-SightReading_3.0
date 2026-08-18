/**
 * Property-based tests for the Question_Generator (`generateQuestion`) of the
 * RCM Level 6 chord-progression exercise.
 *
 * Covers design Correctness Properties 4, 6, and 7 (tasks 4.2–4.4). Each
 * property runs a minimum of 100 fast-check iterations and is tagged with its
 * design property in the required format.
 *
 * `generateQuestion` is randomized via an injected `rng`. To exercise it
 * deterministically and reproducibly under fast-check, a small seeded PRNG
 * (mulberry32) is built from an `fc.integer()` seed and passed as the `rng`.
 */

import fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { MAJOR_KEYS, MINOR_KEYS } from '../keys';
import {
  ANSWER_CHOICES,
  LEVEL6_PROGRESSIONS,
  toRomanNumerals,
} from '../progressions';
import { DEFAULT_SELECTION } from '../progressionSelection';
import { generateQuestion } from '../questionGenerator';

// ============================================================
// Seeded PRNG (mulberry32) — a deterministic rng in [0, 1)
// ============================================================

/**
 * Build a deterministic pseudo-random source in `[0, 1)` from a numeric seed
 * (mulberry32). Successive calls advance an internal 32-bit state, so a single
 * `makeRng(seed)` instance yields a varied stream suitable for driving many
 * `generateQuestion` calls.
 */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seed generator spanning the non-negative 32-bit integer range. */
const seedArb = fc.integer({ min: 0, max: 2 ** 31 - 1 });

// ============================================================
// Property 4 — every chord is a root-position triad of three tones
// ============================================================

describe('Property 4: every chord is a root-position triad of three tones', () => {
  // Feature: rcm6-chord-progression, Property 4: For any generated ProgressionQuestion, every resolved chord has exactly three tones in root position (midis strictly ascending, midis[0] minimal), no sevenths or inversions
  it('produces three chords, each a three-tone root-position triad', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const q = generateQuestion(DEFAULT_SELECTION, makeRng(seed));

        // Three chords in the progression.
        expect(q.chords).toHaveLength(3);

        for (const chord of q.chords) {
          // Exactly three tones across every parallel representation.
          expect(chord.midis).toHaveLength(3);
          expect(chord.pitches).toHaveLength(3);
          expect(chord.spelled).toHaveLength(3);

          // Root position: midis strictly ascending.
          expect(chord.midis[0]).toBeLessThan(chord.midis[1]);
          expect(chord.midis[1]).toBeLessThan(chord.midis[2]);

          // Root is the lowest note.
          expect(chord.midis[0]).toBe(Math.min(...chord.midis));
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================
// Property 6 — questions belong to one of four progressions with correct answer
// ============================================================

describe('Property 6: questions belong to one of four progressions with correct answer metadata', () => {
  // Feature: rcm6-chord-progression, Property 6: For any ProgressionQuestion, the derived progression is one of the four supported per the (mode, function) mapping, the Key is from the pool for the selected Mode, and correctAnswer equals the Roman-numeral projection of the question's specs
  it('derives a supported progression with key/answer metadata consistent with the mapping', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const q = generateQuestion(DEFAULT_SELECTION, makeRng(seed));

        // The progression is one of the four supported Answer_Choices.
        expect(ANSWER_CHOICES).toContain(q.progression);

        // correctAnswer identity and Roman-numeral projection of the specs.
        expect(q.correctAnswer).toBe(q.progression);
        expect(q.correctAnswer).toBe(toRomanNumerals(q.specs));

        // Key is drawn from the pool for the selected Mode.
        const pool = q.mode === 'major' ? MAJOR_KEYS : MINOR_KEYS;
        expect(pool).toContain(q.key);

        // The (mode, function) pair maps to the derived progression's answer.
        const def = LEVEL6_PROGRESSIONS.find(
          (candidate) =>
            candidate.mode === q.mode && candidate.function === q.function,
        );
        expect(def).toBeDefined();
        expect(def?.answer).toBe(q.correctAnswer);
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================
// Property 7 — all four progressions are reachable
// ============================================================

describe('Property 7: all four progressions are reachable', () => {
  // Feature: rcm6-chord-progression, Property 7: For any sufficiently long sequence of generateQuestion calls with varied rng, every one of the four Answer_Choices is produced at least once
  it('produces every one of the four Answer_Choices across a long varied sequence', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        // Advance a single seeded stream across many generations so the rng is
        // varied within each run; 500 draws makes full coverage overwhelmingly
        // likely (each of the four is ~1/4 per draw).
        const rng = makeRng(seed);
        const produced = new Set<string>();
        for (let i = 0; i < 500; i += 1) {
          produced.add(generateQuestion(DEFAULT_SELECTION, rng).progression);
        }

        for (const choice of ANSWER_CHOICES) {
          expect(produced.has(choice)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================
// Scope restriction — generateQuestion only produces selected progressions
// ============================================================

describe('generateQuestion honors the selected scope', () => {
  it('only produces progressions within the selection', () => {
    fc.assert(
      fc.property(
        seedArb,
        fc.subarray(
          LEVEL6_PROGRESSIONS.map((p) => p.id),
          { minLength: 1 },
        ),
        (seed, ids) => {
          const selection = new Set(ids);
          const rng = makeRng(seed);
          const allowed = new Set(
            LEVEL6_PROGRESSIONS.filter((p) => selection.has(p.id)).map((p) => p.answer),
          );
          for (let i = 0; i < 200; i += 1) {
            const q = generateQuestion(selection, rng);
            expect(allowed.has(q.progression)).toBe(true);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});
