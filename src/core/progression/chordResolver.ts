/**
 * The Chord_Resolver for the RCM Level 6 chord-progression exercise (part of the
 * Theory_Layer).
 *
 * Given a Key, Mode, and a {@link ChordSpec}, {@link resolveChord} returns the
 * correctly-spelled tones of a single triad in any of its three inversions. It
 * is pure and framework-free (no React, VexFlow, or Tone.js imports), mirroring
 * the discipline of `src/core/chords/chordGenerator.ts`, whose proven spelling
 * primitives (`LETTERS`, `LETTER_SEMITONES`, `parsePitch`, `accidentalForDiff`,
 * the ±2 accidental limit, and the stacked-thirds letter walk) are reused here.
 *
 * The resolver builds each triad's quality from the {@link ChordSpec.quality}
 * field, NOT from the unaltered natural-scale degree. A minor-key dominant
 * (`degree 5, quality 'major'`) therefore resolves to a MAJOR triad on the
 * raised leading tone — A minor V = `E–G#–B`, never `E–G–B` (Requirement 4).
 *
 * The diatonic degree letter (and its key-signature accidental) comes from
 * {@link diatonicDegrees}, guaranteeing enharmonically correct spelling for the
 * selected Key; the third and fifth are then spelled as stacked thirds above
 * the root letter with the accidental chosen so each tone sounds at the target
 * semitone offset dictated by `spec.quality`.
 *
 * {@link resolveProgression} assembles a whole progression (grand-staff style):
 * the LEFT HAND always plays a single bass note — the chord's root, in a
 * comfortable low register — and the RIGHT HAND plays the full triad voiced in
 * one of its three inversions, chosen so the progression has smooth voice
 * leading between chords and returns to the exact starting voicing for the
 * final tonic (no octave jump).
 */

import type { KeyName, Mode } from './keys';
import { diatonicDegrees } from './keys';
import type { ChordSpec } from './progressions';

// ============================================================
// Types
// ============================================================

/** Which chord tone sits in the bass of the right hand (0 = root position). */
export type RightHandInversion = 0 | 1 | 2;

/**
 * The right hand's voicing of a triad: three spelled tones low→high, with the
 * bass tone determined by `inversion` (0 = root, 1 = third in the bass, 2 =
 * fifth in the bass). All three chord tones (root, third, fifth) are always
 * present exactly once — only their octave placement changes between
 * inversions.
 */
export interface HandVoicing {
  /** Spelled tones with octave, low→high, e.g. `["G4","C5","E5"]`. */
  pitches: string[];
  /** MIDI values parallel to `pitches`, strictly ascending. */
  midis: number[];
  /** Letter+accidental tones without octave, parallel to `pitches`. */
  spelled: string[];
}

/** The left hand's single bass note: the chord's root in a low register. */
export interface BassNote {
  /** Spelled tone with octave, e.g. `"C3"`. */
  pitch: string;
  /** MIDI value. */
  midi: number;
  /** Letter+accidental without octave, e.g. `"C"`. */
  spelled: string;
}

/**
 * A resolved chord, grand-staff style: a right-hand triad voicing plus a
 * left-hand bass root. `pitches`/`midis`/`spelled` are kept at the top level
 * too (bass note + right-hand tones, low→high) for callers that only need "all
 * the tones that sound" (e.g. playback) without caring which hand plays which.
 */
export interface ResolvedChord {
  /** The right hand's three-tone triad voicing. */
  rightHand: HandVoicing;
  /** The left hand's single bass-register root note. */
  leftHand: BassNote;
  /** Which right-hand inversion this chord uses. */
  inversion: RightHandInversion;
  /** All sounding tones low→high: `[leftHand.pitch, ...rightHand.pitches]`. */
  pitches: string[];
  /** MIDI values parallel to `pitches`. */
  midis: number[];
  /** Letter+accidental tones parallel to `pitches`. */
  spelled: string[];
}

// ============================================================
// Letter / semitone / accidental helpers (reused from chordGenerator)
// ============================================================

/** Letter names in diatonic order (a full octave walk). */
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

/** Letter → its index within an octave (C = 0 … B = 6). */
const LETTER_INDEX: Record<string, number> = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6,
};

/** Letter → its natural semitone offset within an octave. */
const LETTER_SEMITONES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** Accidental string → semitone offset. */
const ACCIDENTAL_OFFSET: Record<string, number> = {
  '': 0,
  '#': 1,
  '##': 2,
  b: -1,
  bb: -2,
};

/**
 * Build an accidental string from a semitone difference, or `null` if the
 * magnitude would exceed a double accidental (`|diff| > 2`). Mirrors
 * `chordGenerator.accidentalForDiff`.
 */
function accidentalForDiff(diff: number): string | null {
  if (diff > 2 || diff < -2) return null;
  if (diff === 0) return '';
  return diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff);
}

/**
 * Semitone offsets from the root for the tones of a triad of the given quality:
 * a major triad is `[0, 4, 7]` and a minor triad is `[0, 3, 7]` (Requirements
 * 14.2, 14.3). The offsets come from the {@link ChordSpec.quality} field, so a
 * minor-key V with `quality: 'major'` yields the major offsets and raises the
 * third to the leading tone (Requirement 3.6, 4.1).
 */
function semitonesFromQuality(quality: ChordSpec['quality']): [number, number, number] {
  return quality === 'major' ? [0, 4, 7] : [0, 3, 7];
}

/**
 * Spell a single tone: the letter `2 * stepsFromRoot` diatonic steps above
 * `rootDiatonicStep`, with the accidental chosen so it sounds at
 * `rootMidi + semitoneOffset`.
 *
 * @returns `null` if the required accidental would exceed a double accidental
 */
function spellTone(
  rootDiatonicStep: number,
  rootMidi: number,
  stepsFromRoot: number,
  semitoneOffset: number,
): { pitch: string; midi: number; spelled: string } | null {
  const diatonicStep = rootDiatonicStep + 2 * stepsFromRoot;
  const letterIdx = ((diatonicStep % 7) + 7) % 7;
  const octave = Math.floor(diatonicStep / 7);
  const letter = LETTERS[letterIdx];

  const naturalMidi = LETTER_SEMITONES[letter] + (octave + 1) * 12;
  const targetMidi = rootMidi + semitoneOffset;
  const diff = targetMidi - naturalMidi;

  const accidental = accidentalForDiff(diff);
  if (accidental === null) return null;

  return {
    pitch: `${letter}${accidental}${octave}`,
    midi: targetMidi,
    spelled: `${letter}${accidental}`,
  };
}

// ============================================================
// Base octaves
// ============================================================

/**
 * Default octave for a chord root when none is supplied to {@link
 * resolveChordAtOctave}. Placing the tonic root at octave 4 keeps a
 * root-position triad in a comfortable, playable right-hand range.
 */
export const DEFAULT_ROOT_OCTAVE = 4;

/**
 * Comfortable left-hand bass register: the root letter is placed in octave 2
 * or 3, whichever keeps the bass note closest to (and never above) middle C
 * (`C4`, MIDI 60) while staying audibly in the bass clef. This mirrors a
 * pianist's left hand resting around the bass staff rather than crossing into
 * the treble range.
 */
const BASS_OCTAVE_CANDIDATES = [2, 3] as const;

// ============================================================
// Single-chord resolution (root position, at a given octave)
// ============================================================

/**
 * Resolve a {@link ChordSpec} in a given Key and Mode to a correctly-spelled,
 * ROOT-POSITION triad at a specific root octave. This is the shared primitive
 * both the right-hand voicing builder and the left-hand bass-note picker use;
 * it never applies an inversion itself.
 *
 * @param key        the tonic, spelled as a letter plus optional accidental
 * @param mode       `'major'` or `'minor'`
 * @param spec       the structural chord specification to resolve
 * @param rootOctave the octave of the chord root
 */
function resolveRootPositionTriad(
  key: KeyName,
  mode: Mode,
  spec: ChordSpec,
  rootOctave: number,
): HandVoicing {
  const degrees = diatonicDegrees(key, mode);
  const rootLetterAcc = degrees[spec.degree - 1];

  const rootLetter = rootLetterAcc.charAt(0);
  const rootAccidental = rootLetterAcc.slice(1);
  const rootDiatonicStep = LETTER_INDEX[rootLetter] + rootOctave * 7;
  const rootMidi =
    LETTER_SEMITONES[rootLetter] +
    (ACCIDENTAL_OFFSET[rootAccidental] ?? 0) +
    (rootOctave + 1) * 12;

  const offsets = semitonesFromQuality(spec.quality);

  const pitches: string[] = [];
  const midis: number[] = [];
  const spelled: string[] = [];

  for (let i = 0; i < offsets.length; i += 1) {
    const tone = spellTone(rootDiatonicStep, rootMidi, i, offsets[i]);
    if (tone === null) {
      // For every supported Level 6 Key/spec the accidental is within ±2, so
      // this guard is defensive: surface a defect rather than emit a malformed
      // pitch.
      throw new Error(
        `resolveChord: tone ${i} of ${key} ${mode} degree ${spec.degree} ` +
          `(${spec.quality}) requires more than a double accidental`,
      );
    }
    pitches.push(tone.pitch);
    midis.push(tone.midi);
    spelled.push(tone.spelled);
  }

  return { pitches, midis, spelled };
}

/**
 * Re-voice a root-position triad into the requested inversion by moving the
 * bass tone(s) up an octave: inversion 1 (first inversion) moves the root up
 * an octave so the third is lowest; inversion 2 (second inversion) moves both
 * the root and third up so the fifth is lowest. The result is always sorted
 * low→high.
 *
 * Letters/accidentals never change — only octave placement — so this never
 * fails.
 */
function invertTriad(rootPosition: HandVoicing, inversion: RightHandInversion): HandVoicing {
  if (inversion === 0) return rootPosition;

  const shiftCount = inversion; // 1 → shift the root; 2 → shift root AND third
  const pitches = rootPosition.pitches.slice();
  const midis = rootPosition.midis.slice();
  const spelled = rootPosition.spelled.slice();

  for (let i = 0; i < shiftCount; i += 1) {
    const letter = spelled[i].charAt(0);
    const accidental = spelled[i].slice(1);
    const match = pitches[i].match(/(-?\d+)$/);
    const octave = match ? parseInt(match[1], 10) : 0;
    pitches[i] = `${letter}${accidental}${octave + 1}`;
    midis[i] = midis[i] + 12;
  }

  // Re-sort low→high (shifted tones move to the top).
  const order = midis.map((_, i) => i).sort((a, b) => midis[a] - midis[b]);
  return {
    pitches: order.map((i) => pitches[i]),
    midis: order.map((i) => midis[i]),
    spelled: order.map((i) => spelled[i]),
  };
}

/**
 * Resolve a {@link ChordSpec} to a right-hand triad voicing in the requested
 * `inversion`, with the root-position tones first spelled at
 * {@link DEFAULT_ROOT_OCTAVE} and then re-voiced. Exposed for callers (and
 * tests) that want a single chord's spelling without a full progression.
 *
 * @param key        the tonic, spelled as a letter plus optional accidental
 * @param mode       `'major'` or `'minor'`
 * @param spec       the structural chord specification to resolve
 * @param inversion  which chord tone is in the bass of the right hand
 * @param rootOctave the octave the chord ROOT would sit at in root position
 *                   (default {@link DEFAULT_ROOT_OCTAVE})
 */
export function resolveChord(
  key: KeyName,
  mode: Mode,
  spec: ChordSpec,
  inversion: RightHandInversion = 0,
  rootOctave: number = DEFAULT_ROOT_OCTAVE,
): HandVoicing {
  const rootPosition = resolveRootPositionTriad(key, mode, spec, rootOctave);
  return invertTriad(rootPosition, inversion);
}

/**
 * Resolve the left-hand bass note for a {@link ChordSpec}: always the chord's
 * root, placed in a comfortable low register (never a triad, never inverted).
 *
 * @param key  the tonic, spelled as a letter plus optional accidental
 * @param mode `'major'` or `'minor'`
 * @param spec the structural chord specification to resolve
 */
export function resolveBassNote(key: KeyName, mode: Mode, spec: ChordSpec): BassNote {
  const degrees = diatonicDegrees(key, mode);
  const rootLetterAcc = degrees[spec.degree - 1];
  const rootLetter = rootLetterAcc.charAt(0);
  const rootAccidental = rootLetterAcc.slice(1);

  // Place the root in a comfortable bass-clef register, centered near C3 (MIDI
  // 48, the middle of the bass staff). Pick whichever candidate octave lands
  // closest to that center. Centering on C3 (rather than C4) keeps every
  // supported root at or below F3 (MIDI 53) — strictly beneath the right
  // hand's G3 (55) floor — so the left-hand bass never collides with or rises
  // above the right-hand triad on the grand staff.
  const BASS_CENTER_MIDI = 48; // C3
  let best: BassNote | null = null;
  for (const octave of BASS_OCTAVE_CANDIDATES) {
    const midi =
      LETTER_SEMITONES[rootLetter] +
      (ACCIDENTAL_OFFSET[rootAccidental] ?? 0) +
      (octave + 1) * 12;
    const candidate: BassNote = {
      pitch: `${rootLetter}${rootAccidental}${octave}`,
      midi,
      spelled: `${rootLetter}${rootAccidental}`,
    };
    if (best === null || Math.abs(midi - BASS_CENTER_MIDI) < Math.abs(best.midi - BASS_CENTER_MIDI)) {
      best = candidate;
    }
  }
  // BASS_OCTAVE_CANDIDATES is non-empty, so best is always assigned.
  return best as BassNote;
}

// ============================================================
// Voice leading
// ============================================================

/** Comfortable right-hand register bounds (inclusive), as MIDI note numbers. */
const RIGHT_HAND_MIN_MIDI = 55; // G3
const RIGHT_HAND_MAX_MIDI = 81; // A5

/**
 * Enumerate every right-hand voicing of `spec` (all three inversions, at every
 * octave shift that keeps all three tones within the comfortable register) as
 * candidates for voice-leading selection.
 */
function enumerateRightHandCandidates(
  key: KeyName,
  mode: Mode,
  spec: ChordSpec,
): HandVoicing[] {
  const candidates: HandVoicing[] = [];
  // Try a wide span of root octaves so every inversion can land in-register;
  // octave shifts only move tones, never change letters/accidentals.
  for (let rootOctave = 1; rootOctave <= 6; rootOctave += 1) {
    for (const inversion of [0, 1, 2] as const) {
      const voicing = resolveChord(key, mode, spec, inversion, rootOctave);
      const inRange = voicing.midis.every(
        (m) => m >= RIGHT_HAND_MIN_MIDI && m <= RIGHT_HAND_MAX_MIDI,
      );
      if (inRange) candidates.push(voicing);
    }
  }
  return candidates;
}

/**
 * Voice-leading cost between two three-tone voicings: the sum of the absolute
 * semitone movement of each corresponding voice (bass→bass, middle→middle,
 * top→top). Lower is smoother.
 */
function voiceLeadingCost(prev: HandVoicing, next: HandVoicing): number {
  let cost = 0;
  for (let i = 0; i < 3; i += 1) {
    cost += Math.abs(next.midis[i] - prev.midis[i]);
  }
  return cost;
}

/** Tolerance (in summed semitones) for the "acceptable" voice-leading pool. */
const VOICE_LEADING_TOLERANCE = 4;

/**
 * Choose a right-hand voicing for the middle chord: rank every in-register
 * candidate by voice-leading cost against `previous`, then pick uniformly at
 * random among the candidates within {@link VOICE_LEADING_TOLERANCE} semitones
 * of the best cost. This keeps the progression musically smooth while still
 * varying which inversion/voicing shows up across questions (never always the
 * single lowest-cost candidate).
 */
function pickVoicedCandidate(
  candidates: readonly HandVoicing[],
  previous: HandVoicing,
  rng: () => number,
): HandVoicing {
  const ranked = candidates
    .map((voicing) => ({ voicing, cost: voiceLeadingCost(previous, voicing) }))
    .sort((a, b) => a.cost - b.cost);
  const bestCost = ranked[0].cost;
  const acceptable = ranked.filter((c) => c.cost <= bestCost + VOICE_LEADING_TOLERANCE);
  const index = Math.floor(rng() * acceptable.length);
  return acceptable[index].voicing;
}

// ============================================================
// Progression resolution (grand staff: right-hand voice leading + left-hand roots)
// ============================================================

/**
 * Resolve a whole Progression (an ordered Chord_Spec sequence, three chords at
 * Level 6) into grand-staff {@link ResolvedChord}s.
 *
 * - LEFT HAND: every chord's bass note is its root, placed once per chord by
 *   {@link resolveBassNote} in a comfortable low register. The left hand never
 *   plays a triad and is never inverted.
 * - RIGHT HAND: the first (tonic) chord gets a RANDOMLY chosen inversion in a
 *   comfortable register (Requirement: vary which inversion opens the
 *   exercise). The middle chord's voicing is chosen for smooth voice leading
 *   against the first chord — ranked by total semitone movement across the
 *   three voices, picked at random among the near-best candidates (tolerance
 *   {@link VOICE_LEADING_TOLERANCE}) so repeated practice surfaces varied
 *   voicings rather than always the single smoothest one. The final tonic
 *   REUSES the exact right-hand voicing (same pitches, same octave) of the
 *   first chord, so the progression returns to its starting point rather than
 *   jumping up an octave.
 *
 * Pure given `rng`; deterministic for a fixed `rng` sequence. Never throws for
 * supported Level 6 inputs.
 *
 * @param key   the tonic, spelled as a letter plus optional accidental
 * @param mode  `'major'` or `'minor'`
 * @param specs the ordered Chord_Spec sequence (three at Level 6)
 * @param rng   random source in `[0, 1)`; defaults to `Math.random`
 * @returns the resolved chords in progression order
 */
export function resolveProgression(
  key: KeyName,
  mode: Mode,
  specs: readonly ChordSpec[],
  rng: () => number = Math.random,
): ResolvedChord[] {
  const assemble = (rightHand: HandVoicing, leftHand: BassNote, inversion: RightHandInversion): ResolvedChord => ({
    rightHand,
    leftHand,
    inversion,
    pitches: [leftHand.pitch, ...rightHand.pitches],
    midis: [leftHand.midi, ...rightHand.midis],
    spelled: [leftHand.spelled, ...rightHand.spelled],
  });

  const firstSpec = specs[0];
  const firstLeftHand = resolveBassNote(key, mode, firstSpec);
  const firstCandidates = enumerateRightHandCandidates(key, mode, firstSpec);

  // Pick the first chord's right-hand voicing: randomly draw a target
  // inversion (0/1/2) and choose uniformly among the in-register candidates
  // that realize it, falling back to any in-register candidate if that
  // inversion has none (should not happen for Level 6 keys, but keeps the
  // function total).
  const firstInversionIndex = Math.floor(rng() * 3) as RightHandInversion;
  const byInversion = (inv: RightHandInversion) =>
    firstCandidates.filter((c) => bassVoiceInversion(c, firstLeftHand) === inv);
  const firstGroup = byInversion(firstInversionIndex);
  const firstGroupToUse = firstGroup.length > 0 ? firstGroup : firstCandidates;
  const firstRightHand = firstGroupToUse[Math.floor(rng() * firstGroupToUse.length)];

  const chords: ResolvedChord[] = [
    assemble(firstRightHand, firstLeftHand, firstInversionIndex),
  ];

  let previousRightHand = firstRightHand;
  for (let i = 1; i < specs.length - 1; i += 1) {
    const spec = specs[i];
    const leftHand = resolveBassNote(key, mode, spec);
    const candidates = enumerateRightHandCandidates(key, mode, spec);
    const rightHand = pickVoicedCandidate(candidates, previousRightHand, rng);
    chords.push(assemble(rightHand, leftHand, bassVoiceInversion(rightHand, leftHand)));
    previousRightHand = rightHand;
  }

  // Final tonic: reuse the exact starting right-hand voicing and left-hand
  // bass note, so the progression returns to its starting point instead of
  // jumping an octave higher.
  if (specs.length > 1) {
    chords.push(assemble(firstRightHand, firstLeftHand, firstInversionIndex));
  }

  return chords;
}

/**
 * Determine which inversion a resolved right-hand voicing represents, by
 * comparing its lowest spelled tone against the chord's root letter (from the
 * left-hand bass note, which is always the root). Root in the bass → 0; third
 * in the bass → 1; fifth in the bass → 2.
 */
function bassVoiceInversion(rightHand: HandVoicing, leftHand: BassNote): RightHandInversion {
  const lowestLetter = rightHand.spelled[0].charAt(0);
  const rootLetter = leftHand.spelled.charAt(0);
  if (lowestLetter === rootLetter) return 0;
  // Stacked-thirds triad: the letter two diatonic steps above the root is the
  // third; four steps above is the fifth.
  const rootIdx = LETTER_INDEX[rootLetter];
  const lowestIdx = LETTER_INDEX[lowestLetter];
  const stepsAbove = ((lowestIdx - rootIdx) % 7 + 7) % 7;
  return stepsAbove === 2 ? 1 : 2;
}
