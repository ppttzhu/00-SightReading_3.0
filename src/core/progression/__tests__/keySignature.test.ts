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

/**
 * The accidentals the notation would draw for each hand of a progression,
 * mirroring the grand-staff renderer: the left hand draws its single bass root
 * on the bass clef, the right hand draws its three triad tones on the treble
 * clef. Each entry is `{ bass, rightHand }` where `bass` is a single symbol
 * (or null) and `rightHand` is a three-element array of symbols (or null).
 */
function drawnAccidentals(key: string, mode: 'major' | 'minor', specs: readonly (typeof CHORD_SPECS)[keyof typeof CHORD_SPECS][]) {
  const sig = keySignatureFor(key, mode);
  const draw = (tone: string) => {
    const { letter, accidental } = splitTone(tone);
    return accidentalToDraw(letter, accidental, sig.perLetter);
  };
  return resolveProgression(key, mode, specs).map((chord) => ({
    bass: draw(chord.leftHand.spelled),
    rightHand: chord.rightHand.spelled.map(draw),
  }));
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

/** Non-null accidental symbols the right hand draws for a chord (order-free). */
function rightHandDrawn(chord: { rightHand: (string | null)[] }): string[] {
  return chord.rightHand.filter((a): a is string => a !== null);
}

describe('note-level accidental suppression (key_signature_rules_for_ai.md §10)', () => {
  // The bass root is always a diatonic degree root, so the left hand never
  // draws a local accidental; the altered leading tone lives in the right-hand
  // triad. Right-hand order can vary by inversion, so assert the drawn set.
  it('Eb major I–IV–I draws NO local accidentals (all covered by the key signature)', () => {
    const drawn = drawnAccidentals('Eb', 'major', [CHORD_SPECS.I, CHORD_SPECS.IV, CHORD_SPECS.I]);
    // Eb-G-Bb → Ab-C-Eb → Eb-G-Bb: every flat is in the 3-flat signature.
    for (const chord of drawn) {
      expect(chord.bass).toBeNull();
      expect(rightHandDrawn(chord)).toEqual([]);
    }
  });

  it('C minor i–V–i draws only B-natural in the V chord', () => {
    const drawn = drawnAccidentals('C', 'minor', [CHORD_SPECS.i, CHORD_SPECS.V, CHORD_SPECS.i]);
    // i = C-Eb-G → nothing drawn (Eb covered by signature).
    expect(rightHandDrawn(drawn[0])).toEqual([]);
    // V = G-B-D → B must show a natural (signature expects Bb).
    expect(rightHandDrawn(drawn[1])).toEqual(['n']);
    // final i = C-Eb-G → nothing drawn.
    expect(rightHandDrawn(drawn[2])).toEqual([]);
    // The left-hand bass never draws an accidental.
    drawn.forEach((chord) => expect(chord.bass).toBeNull());
  });

  it('A minor i–V–i draws only G# in the V chord', () => {
    const drawn = drawnAccidentals('A', 'minor', [CHORD_SPECS.i, CHORD_SPECS.V, CHORD_SPECS.i]);
    // i = A-C-E → nothing (no signature).
    expect(rightHandDrawn(drawn[0])).toEqual([]);
    // V = E-G#-B → G# is a local sharp (raised leading tone).
    expect(rightHandDrawn(drawn[1])).toEqual(['#']);
    expect(rightHandDrawn(drawn[2])).toEqual([]);
    drawn.forEach((chord) => expect(chord.bass).toBeNull());
  });

  it('G minor V draws F# (raised leading tone) and nothing else', () => {
    const drawn = drawnAccidentals('G', 'minor', [CHORD_SPECS.i, CHORD_SPECS.V, CHORD_SPECS.i]);
    // V = D-F#-A → F# local sharp; D and A are natural in the 2-flat signature.
    expect(rightHandDrawn(drawn[1])).toEqual(['#']);
    expect(drawn[1].bass).toBeNull();
  });
});
