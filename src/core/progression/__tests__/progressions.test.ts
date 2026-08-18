import { describe, it, expect } from 'vitest';
import {
  CHORD_SPECS,
  LEVEL6_PROGRESSIONS,
  ANSWER_CHOICES,
  toRomanNumerals,
  type ProgressionDef,
} from '../progressions';

// ---------------------------------------------------------------------------
// Task 2.2 — Example / unit tests for progressions.ts
// ---------------------------------------------------------------------------

/** Look up the single ProgressionDef for a (mode, function) pair. */
function progressionFor(
  mode: ProgressionDef['mode'],
  fn: ProgressionDef['function'],
): ProgressionDef {
  const match = LEVEL6_PROGRESSIONS.find(
    (p) => p.mode === mode && p.function === fn,
  );
  if (match === undefined) {
    throw new Error(`no progression for ${mode} ${fn}`);
  }
  return match;
}

describe('LEVEL6_PROGRESSIONS (Requirements 1.1, 2.4, 2.5, 2.6, 2.7)', () => {
  it('has exactly the four supported progressions', () => {
    expect(LEVEL6_PROGRESSIONS).toHaveLength(4);
  });

  it('major + subdominant maps to [I, IV, I] / "I – IV – I"', () => {
    const p = progressionFor('major', 'subdominant');
    expect(p.specs).toEqual([CHORD_SPECS.I, CHORD_SPECS.IV, CHORD_SPECS.I]);
    expect(p.answer).toBe('I – IV – I');
  });

  it('major + dominant maps to [I, V, I] / "I – V – I"', () => {
    const p = progressionFor('major', 'dominant');
    expect(p.specs).toEqual([CHORD_SPECS.I, CHORD_SPECS.V, CHORD_SPECS.I]);
    expect(p.answer).toBe('I – V – I');
  });

  it('minor + subdominant maps to [i, iv, i] / "i – iv – i"', () => {
    const p = progressionFor('minor', 'subdominant');
    expect(p.specs).toEqual([CHORD_SPECS.i, CHORD_SPECS.iv, CHORD_SPECS.i]);
    expect(p.answer).toBe('i – iv – i');
  });

  it('minor + dominant maps to [i, V, i] / "i – V – i"', () => {
    const p = progressionFor('minor', 'dominant');
    expect(p.specs).toEqual([CHORD_SPECS.i, CHORD_SPECS.V, CHORD_SPECS.i]);
    expect(p.answer).toBe('i – V – i');
  });

  it('the minor-dominant middle spec is the MAJOR V (raised leading tone)', () => {
    const p = progressionFor('minor', 'dominant');
    // The middle chord references the shared major V building block, which is
    // what forces the resolver to raise the leading tone.
    expect(p.specs[1]).toBe(CHORD_SPECS.V);
    expect(p.specs[1].quality).toBe('major');
  });
});

describe('ANSWER_CHOICES (Requirement 9.1)', () => {
  it('has exactly the four choices in fixed display order', () => {
    expect(ANSWER_CHOICES).toEqual([
      'I – IV – I',
      'I – V – I',
      'i – iv – i',
      'i – V – i',
    ]);
    expect(ANSWER_CHOICES).toHaveLength(4);
  });
});

describe('toRomanNumerals (Requirements 12.5, 2.4, 2.5, 2.6, 2.7)', () => {
  it('projects each progression\u2019s specs to its correct AnswerChoice', () => {
    for (const progression of LEVEL6_PROGRESSIONS) {
      expect(toRomanNumerals(progression.specs)).toBe(progression.answer);
    }
  });

  it('maps the four (mode, function) pairs to the expected answers', () => {
    expect(toRomanNumerals(progressionFor('major', 'subdominant').specs)).toBe(
      'I – IV – I',
    );
    expect(toRomanNumerals(progressionFor('major', 'dominant').specs)).toBe(
      'I – V – I',
    );
    expect(toRomanNumerals(progressionFor('minor', 'subdominant').specs)).toBe(
      'i – iv – i',
    );
    expect(toRomanNumerals(progressionFor('minor', 'dominant').specs)).toBe(
      'i – V – i',
    );
  });
});
