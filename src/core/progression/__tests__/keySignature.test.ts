/**
 * Tests for key-signature resolution and note-level accidental suppression
 * (see key_signature_rules_for_ai.md). These validate the Theory-layer facts
 * the notation layer relies on: the per-letter signature map (used to suppress
 * redundant accidentals) and the VexFlow key spec (rendered after the clef).
 */

import { describe, it, expect } from 'vitest';

import { keySignatureFor } from '../keys';
import { resolveProgression } from '../chordResolver';
import { CHORD_SPECS } from '../progressions';

/**
 * Mirror of ProgressionPractice's `accidentalToDraw`: given the key signature's
 * per-letter map, decide which accidental symbol (if any) a tone draws.
 */
function accidentalToDraw(
  letter: string,
  accidental: string,
  sig: Record<string, string>,
): string | null {
  const sigAcc = sig[letter] ?? '';
  if (accidental === sigAcc) return null;
  if (accidental === '') return 'n';
  return accidental;
}

/** Split a spelled tone like "Bb" / "G#" / "E" into { letter, accidental }. */
function splitTone(spelled: string): { letter: string; accidental: string } {
  return { letter: spelled.charAt(0), accidental: spelled.slice(1) };
}

/** The accidentals the notation would draw for each tone of a progression. */
function drawnAccidentals(key: string, mode: 'major' | 'minor', specs: readonly (typeof CHORD_SPECS)[keyof typeof CHORD_SPECS][]) {
  const sig = keySignatureFor(key, mode);
  return resolveProgression(key, mode, specs).map((chord) =>
    chord.spelled.map((tone) => {
      const { letter, accidental } = splitTone(tone);
      return accidentalToDraw(letter, accidental, sig.perLetter);
    }),
  );
}

describe('keySignatureFor', () => {
  it('maps major keys to their signature accidentals and a plain VexFlow spec', () => {
    const eb = keySignatureFor('Eb', 'major');
    expect(eb.vexKeySpec).toBe('Eb');
    expect(eb.perLetter.B).toBe('b');
    expect(eb.perLetter.E).toBe('b');
    expect(eb.perLetter.A).toBe('b');
    expect(eb.perLetter.C).toBe('');
    expect(eb.perLetter.D).toBe('');

    const c = keySignatureFor('C', 'major');
    expect(c.vexKeySpec).toBe('C');
    expect(Object.values(c.perLetter).every((a) => a === '')).toBe(true);
  });

  it('maps minor keys to the natural-minor signature and an `m` VexFlow spec', () => {
    const cm = keySignatureFor('C', 'minor');
    expect(cm.vexKeySpec).toBe('Cm');
    expect(cm.perLetter.B).toBe('b');
    expect(cm.perLetter.E).toBe('b');
    expect(cm.perLetter.A).toBe('b');

    const am = keySignatureFor('A', 'minor');
    expect(am.vexKeySpec).toBe('Am');
    expect(Object.values(am.perLetter).every((a) => a === '')).toBe(true);
  });
});

describe('note-level accidental suppression (key_signature_rules_for_ai.md §10)', () => {
  it('Eb major I–IV–I draws NO local accidentals (all covered by the key signature)', () => {
    const drawn = drawnAccidentals('Eb', 'major', [CHORD_SPECS.I, CHORD_SPECS.IV, CHORD_SPECS.I]);
    // Eb-G-Bb → Ab-C-Eb → Eb-G-Bb: every flat is in the 3-flat signature.
    for (const chord of drawn) {
      expect(chord).toEqual([null, null, null]);
    }
  });

  it('C minor i–V–i draws only B-natural in the V chord', () => {
    const drawn = drawnAccidentals('C', 'minor', [CHORD_SPECS.i, CHORD_SPECS.V, CHORD_SPECS.i]);
    // i = C-Eb-G → nothing drawn (Eb covered by signature).
    expect(drawn[0]).toEqual([null, null, null]);
    // V = G-B-D → B must show a natural (signature expects Bb).
    expect(drawn[1]).toEqual([null, 'n', null]);
    // final i = C-Eb-G → nothing drawn.
    expect(drawn[2]).toEqual([null, null, null]);
  });

  it('A minor i–V–i draws only G# in the V chord', () => {
    const drawn = drawnAccidentals('A', 'minor', [CHORD_SPECS.i, CHORD_SPECS.V, CHORD_SPECS.i]);
    // i = A-C-E → nothing (no signature).
    expect(drawn[0]).toEqual([null, null, null]);
    // V = E-G#-B → G# is a local sharp (raised leading tone).
    expect(drawn[1]).toEqual([null, '#', null]);
    expect(drawn[2]).toEqual([null, null, null]);
  });

  it('G minor V draws F# (raised leading tone) and nothing else', () => {
    const drawn = drawnAccidentals('G', 'minor', [CHORD_SPECS.i, CHORD_SPECS.V, CHORD_SPECS.i]);
    // V = D-F#-A → F# local sharp; D and A are natural in the 2-flat signature.
    expect(drawn[1]).toEqual([null, '#', null]);
  });
});
