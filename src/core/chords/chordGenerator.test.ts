import { describe, it, expect, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { CHORD_CATALOG, CATALOG_BY_ID, type ChordType } from './chordCatalog';
import {
  spellChord,
  validateChord,
  generateQuestion,
} from './chordGenerator';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Deterministic, reproducible rng in [0, 1) seeded from an integer. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const LETTER_INDEX: Record<string, number> = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6,
};
const LETTER_SEMITONES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};
const ACCIDENTAL_OFFSET: Record<string, number> = {
  '': 0,
  '#': 1,
  '##': 2,
  b: -1,
  bb: -2,
};
const PITCH_PATTERN = /^([A-G])(#{1,2}|b{1,2})?(-?\d+)$/;

/** Independent test-side pitch parser (mirrors the production letter/MIDI model). */
function parsePitch(
  pitch: string,
): { letter: string; accidental: string; diatonicStep: number; midi: number } | null {
  const m = PITCH_PATTERN.exec(pitch);
  if (m === null) return null;
  const letter = m[1];
  const accidental = m[2] ?? '';
  const octave = Number.parseInt(m[3], 10);
  const offset = ACCIDENTAL_OFFSET[accidental];
  return {
    letter,
    accidental,
    diatonicStep: LETTER_INDEX[letter] + octave * 7,
    midi: LETTER_SEMITONES[letter] + offset + (octave + 1) * 12,
  };
}

/** Build a spelled pitch string. */
function makePitch(letter: string, accidental: string, octave: number): string {
  return `${letter}${accidental}${octave}`;
}

/**
 * A crafted chord type that cannot be spelled on ANY white-key root within a
 * double sharp/flat: its second tone sits two letter-steps up (a third, natural
 * distance 3–4 semitones) but must sound 0 semitones from the root, forcing a
 * −3 or −4 accidental. Used to exercise the null / no-placeable-chord branch.
 */
const UNPLACEABLE_TYPE: ChordType = {
  id: 'stub-unplaceable',
  uiLabel: 'Stub',
  noteCount: 2,
  stackedStructure: [0],
  semitonesFromRoot: [0, 0],
  example: [],
};

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Task 4.2 — Example / unit tests
// ---------------------------------------------------------------------------

describe('spellChord example cases (Requirement 7.3)', () => {
  const dim7 = CATALOG_BY_ID.get('dim7') as ChordType;

  it("spellChord('C4', dim7) → ['C4','Eb4','Gb4','Bbb4']", () => {
    const result = spellChord('C4', dim7);
    expect(result).not.toBeNull();
    expect(result?.pitches).toEqual(['C4', 'Eb4', 'Gb4', 'Bbb4']);
    expect(result?.midis).toEqual([60, 63, 66, 69]);
  });
});

describe('generateQuestion no-placeable-chord branch (Requirement 6.7)', () => {
  it('returns {ok:false, reason:"no-placeable-chord"} for a stubbed unplaceable type', () => {
    // Inject the unplaceable type by making id resolution return the stub.
    vi.spyOn(CATALOG_BY_ID, 'get').mockReturnValue(UNPLACEABLE_TYPE);

    const result = generateQuestion(new Set(['stub-unplaceable']), makeRng(1));
    expect(result).toEqual({ ok: false, reason: 'no-placeable-chord' });
  });

  it('the stubbed type is genuinely unspellable on every white-key root', () => {
    for (let octave = 1; octave <= 7; octave += 1) {
      for (const letter of LETTERS) {
        expect(spellChord(`${letter}${octave}`, UNPLACEABLE_TYPE)).toBeNull();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Task 4.3 — Property 8
// ---------------------------------------------------------------------------

// Feature: chord-random-scope-selection, Property 8: For any chord type and any
// accepted root, the tones returned by spellChord are assigned to letter names
// stacked in thirds from the root letter (each tone's letter is two letter-steps
// above the previous), every tone sounds at its semitonesFromRoot offset above
// the root (midi[i] - midi[0] === semitonesFromRoot[i]), and no tone uses more
// than a double sharp or double flat; conversely, when a root would force any
// tone beyond a double sharp/flat, spellChord returns null. In particular a C
// diminished 7th's seventh is spelled Bbb.
// Validates: Requirements 7.1, 7.2, 7.3, 7.4
describe('Property 8: spellChord produces enharmonically correct stacked thirds', () => {
  const rootArb = fc.record({
    letter: fc.constantFrom(...LETTERS),
    accidental: fc.constantFrom('', '#', '##', 'b', 'bb'),
    octave: fc.integer({ min: 1, max: 7 }),
  });

  it('accepted roots yield stacked-thirds, offset-correct, ±2-bounded spellings', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...CHORD_CATALOG),
        rootArb,
        (chordType, { letter, accidental, octave }) => {
          const rootSpelled = makePitch(letter, accidental, octave);
          const rootParsed = parsePitch(rootSpelled);
          if (rootParsed === null) return; // unreachable — generator is well-formed

          const result = spellChord(rootSpelled, chordType);
          if (result === null) return; // rejected roots are covered by the null test below

          const parsed = result.pitches.map((p) => parsePitch(p));
          // Every spelled pitch parses.
          expect(parsed.every((p) => p !== null)).toBe(true);
          const tones = parsed as NonNullable<(typeof parsed)[number]>[];

          // Letters stacked in thirds: each tone is two letter-steps above the root.
          tones.forEach((t, i) => {
            expect(t.diatonicStep - rootParsed.diatonicStep).toBe(2 * i);
          });

          // Every tone sounds at its semitonesFromRoot offset above the root.
          tones.forEach((t, i) => {
            expect(t.midi - rootParsed.midi).toBe(chordType.semitonesFromRoot[i]);
            expect(result.midis[i]).toBe(t.midi);
          });

          // No accidental beyond a double sharp / double flat.
          tones.forEach((t) => {
            expect(t.accidental.length).toBeLessThanOrEqual(2);
          });
        },
      ),
      { numRuns: 200 },
    );
  });

  it('returns null exactly when some tone would need more than ±2 accidentals', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...CHORD_CATALOG),
        rootArb,
        (chordType, { letter, accidental, octave }) => {
          const rootSpelled = makePitch(letter, accidental, octave);
          const rootParsed = parsePitch(rootSpelled);
          if (rootParsed === null) return;

          // Independently decide whether any tone needs more than ±2 accidentals.
          let needsNull = false;
          for (let i = 0; i < chordType.semitonesFromRoot.length; i += 1) {
            const step = rootParsed.diatonicStep + 2 * i;
            const letterIdx = ((step % 7) + 7) % 7;
            const oct = Math.floor(step / 7);
            const natural = LETTER_SEMITONES[LETTERS[letterIdx]] + (oct + 1) * 12;
            const target = rootParsed.midi + chordType.semitonesFromRoot[i];
            if (Math.abs(target - natural) > 2) needsNull = true;
          }

          const result = spellChord(rootSpelled, chordType);
          expect(result === null).toBe(needsNull);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("spells a C diminished 7th's seventh as Bbb", () => {
    const dim7 = CATALOG_BY_ID.get('dim7') as ChordType;
    const result = spellChord('C4', dim7);
    expect(result?.pitches[3]).toBe('Bbb4');
  });
});

// ---------------------------------------------------------------------------
// Task 4.4 — Property 9
// ---------------------------------------------------------------------------

/** Enumerate white-key roots that spell `chordType` within the playable range. */
function acceptedWhiteRoots(chordType: ChordType): string[] {
  const roots: string[] = [];
  for (let octave = 1; octave <= 7; octave += 1) {
    for (const letter of LETTERS) {
      const rootMidi = LETTER_SEMITONES[letter] + (octave + 1) * 12;
      if (rootMidi < 36 || rootMidi > 96) continue;
      const spelled = spellChord(`${letter}${octave}`, chordType);
      if (spelled === null) continue;
      if (spelled.midis.every((m) => m >= 36 && m <= 96)) {
        roots.push(`${letter}${octave}`);
      }
    }
  }
  return roots;
}

/** Respell a pitch to a DIFFERENT letter name of the same pitch class, within ±2. */
function enharmonicRespell(pitch: string): string | null {
  const p = parsePitch(pitch);
  if (p === null) return null;
  const midi = p.midi;
  // Try nearby letters/octaves for an alternate spelling of the same MIDI.
  for (let octave = -1; octave <= 9; octave += 1) {
    for (const letter of LETTERS) {
      if (letter === p.letter) continue;
      const natural = LETTER_SEMITONES[letter] + (octave + 1) * 12;
      const diff = midi - natural;
      if (Math.abs(diff) > 2) continue;
      const acc = diff === 0 ? '' : diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff);
      const candidate = makePitch(letter, acc, octave);
      const parsedCandidate = parsePitch(candidate);
      if (parsedCandidate && parsedCandidate.midi === midi) return candidate;
    }
  }
  return null;
}

// Feature: chord-random-scope-selection, Property 9: For any chord type and any
// accepted root, validateChord accepts the tones produced by spellChord; and for
// any single perturbation of a correctly spelled chord — altering a successive
// semitone gap, altering a tone's offset from the root, or respelling a tone to a
// different letter name of the same pitch class — validateChord rejects it. A
// chord is reported valid only when the stacked-structure, semitones-from-root,
// and letter-stacking checks all pass.
// Validates: Requirements 8.1, 8.2, 8.3, 8.4
describe('Property 9: validateChord soundness and rejection', () => {
  it('accepts every correctly spelled chord (soundness)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...CHORD_CATALOG),
        fc.integer({ min: 0, max: 1000 }),
        (chordType, rootSeed) => {
          const roots = acceptedWhiteRoots(chordType);
          const rootSpelled = roots[rootSeed % roots.length];
          const spelled = spellChord(rootSpelled, chordType);
          expect(spelled).not.toBeNull();
          expect(validateChord((spelled as { pitches: string[] }).pitches, chordType)).toBe(true);
        },
      ),
      { numRuns: 150 },
    );
  });

  it('rejects any single perturbation (gap / offset / letter respelling)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...CHORD_CATALOG),
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 0, max: 1000 }),
        fc.constantFrom('shift', 'respell'),
        fc.integer({ min: 0, max: 1000 }),
        (chordType, rootSeed, toneSeed, kind, deltaSeed) => {
          const roots = acceptedWhiteRoots(chordType);
          const rootSpelled = roots[rootSeed % roots.length];
          const spelled = spellChord(rootSpelled, chordType);
          if (spelled === null) return;
          const pitches = spelled.pitches;
          const n = pitches.length;

          if (kind === 'shift') {
            // Alter one tone's MIDI (breaks a successive gap and its offset) by
            // respelling it at the SAME letter with a different accidental.
            const i = toneSeed % n;
            const deltas = [1, 2, -1, -2];
            const delta = deltas[deltaSeed % deltas.length];
            const p = parsePitch(pitches[i]);
            if (p === null) return;
            const newMidi = p.midi + delta;
            // Same-letter accidental for the shifted MIDI, if within ±2.
            const octave = Math.floor(p.diatonicStep / 7);
            const natural = LETTER_SEMITONES[p.letter] + (octave + 1) * 12;
            const diff = newMidi - natural;
            if (Math.abs(diff) > 2) return; // skip unspellable shifts
            const acc = diff === 0 ? '' : diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff);
            const perturbed = pitches.slice();
            perturbed[i] = makePitch(p.letter, acc, octave);
            if (perturbed[i] === pitches[i]) return; // no actual change
            expect(validateChord(perturbed, chordType)).toBe(false);
          } else {
            // Respell one tone to a different letter of the same pitch class
            // (breaks letter stacking; MIDI unchanged).
            const i = toneSeed % n;
            const respelled = enharmonicRespell(pitches[i]);
            if (respelled === null || respelled === pitches[i]) return;
            const perturbed = pitches.slice();
            perturbed[i] = respelled;
            expect(validateChord(perturbed, chordType)).toBe(false);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Task 4.5 — Property 10
// ---------------------------------------------------------------------------

const ALL_IDS = CHORD_CATALOG.map((e) => e.id);

// Feature: chord-random-scope-selection, Property 10: For any non-empty selection
// of catalog ids, when generateQuestion returns ok:true, the question's chord type
// is a member of the selection, its MIDI values are strictly ascending with the
// root as the lowest tone and a span of fewer than 24 semitones (root position,
// close position), every tone lies within C2–C7, its spelled pitches parse back
// exactly to its midis, and validateChord(question.pitches, question.chordType) is
// true.
// Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 7.5, 8.5
describe('Property 10: every generated question is valid, in-scope, in-range, root/close position', () => {
  it('holds for any non-empty selection', () => {
    fc.assert(
      fc.property(
        fc.subarray(ALL_IDS, { minLength: 1 }),
        fc.integer({ min: 0, max: 100000 }),
        (ids, seed) => {
          const selection = new Set(ids);
          const result = generateQuestion(selection, makeRng(seed));

          // Every catalog type is placeable, so a non-empty selection must succeed.
          expect(result.ok).toBe(true);
          if (!result.ok) return;
          const q = result.question;

          // Chord type is in the selection.
          expect(selection.has(q.chordType.id)).toBe(true);
          expect(q.correctAnswer).toBe(q.chordType);

          // MIDIs strictly ascending, root lowest, span < 24 (close position).
          for (let i = 1; i < q.midis.length; i += 1) {
            expect(q.midis[i]).toBeGreaterThan(q.midis[i - 1]);
          }
          expect(q.midis[0]).toBe(Math.min(...q.midis));
          expect(q.midis[q.midis.length - 1] - q.midis[0]).toBeLessThan(24);

          // All tones within C2–C7.
          q.midis.forEach((m) => {
            expect(m).toBeGreaterThanOrEqual(36);
            expect(m).toBeLessThanOrEqual(96);
          });

          // Spelled pitches parse back exactly to the midis.
          q.pitches.forEach((pitch, i) => {
            const parsed = parsePitch(pitch);
            expect(parsed).not.toBeNull();
            expect(parsed?.midi).toBe(q.midis[i]);
          });

          // The validation guard accepts the question.
          expect(validateChord(q.pitches, q.chordType)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Task 4.6 — Property 11
// ---------------------------------------------------------------------------

// Feature: chord-random-scope-selection, Property 11: For any selection consisting
// of arbitrary strings (valid ids, invalid tokens, or a mix), generateQuestion
// returns a discriminated result (ok:true with a question or ok:false with a
// reason) and never throws. An empty selection, or one containing no valid catalog
// id, returns { ok: false, reason: 'empty-selection' }.
// Validates: Requirements 6.6, 6.8
describe('Property 11: generator totality', () => {
  const tokenArb = fc.oneof(fc.constantFrom(...ALL_IDS), fc.string());

  it('never throws and returns a well-formed discriminated result', () => {
    fc.assert(
      fc.property(
        fc.array(tokenArb),
        fc.integer({ min: 0, max: 100000 }),
        (tokens, seed) => {
          const selection = new Set(tokens);

          let result: ReturnType<typeof generateQuestion> | undefined;
          expect(() => {
            result = generateQuestion(selection, makeRng(seed));
          }).not.toThrow();

          const res = result as ReturnType<typeof generateQuestion>;
          expect(typeof res.ok).toBe('boolean');

          const validIds = [...selection].filter((t) => CATALOG_BY_ID.has(t));
          if (validIds.length === 0) {
            expect(res).toEqual({ ok: false, reason: 'empty-selection' });
          } else {
            // Every catalog type is placeable, so a valid id guarantees success.
            expect(res.ok).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('empty selection returns empty-selection', () => {
    expect(generateQuestion(new Set())).toEqual({
      ok: false,
      reason: 'empty-selection',
    });
  });
});
