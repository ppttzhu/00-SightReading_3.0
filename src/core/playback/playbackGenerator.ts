/**
 * RCM Level 6 Playback random question generator (per `.kiro/specs/playback/rule.md`).
 *
 * Generates a short, tonal, singable melody in scale degrees, then converts to
 * spelled pitches for the chosen key. Enforces the hard syllabus rules via a
 * validator with a regenerate-on-failure loop; soft rules use weighted
 * randomness so exercises stay varied. Pure and framework-free (rng injectable).
 */

import type { Meter, PlaybackKey, PlaybackQuestion, MelodyNote } from './playbackTypes';
import { PLAYBACK_KEYS } from './playbackTypes';
import { degreeToPitch, keyInfo, pitchToMidi, raisedLeadingTone, tonicChord } from './playbackKeys';
import { targetSequence } from './melodyMatch';
import { PLAYBACK_BANK } from './playbackBank';

/** A scale-degree note in the contour (degree 1..8, raised leading tone flagged). */
interface DegreeNote {
  degree: number;
  beats: number;
  /** When true, degree 7 is the raised leading tone (minor keys). */
  raised?: boolean;
}

const ALLOWED_START = [1, 3, 5, 8] as const;

/** Pick one element uniformly. */
function pick<T>(items: readonly T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)];
}

/** Weighted pick: `entries` is [value, weight]. */
function weighted<T>(entries: readonly (readonly [T, number])[], rng: () => number): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [v, w] of entries) {
    r -= w;
    if (r <= 0) return v;
  }
  return entries[entries.length - 1][0];
}

// ============================================================
// Rhythm
// ============================================================

/** Fill one beat with either a quarter or a pair of eighths (occasionally dotted-quarter+eighth). */
function beatCell(rng: () => number): number[] {
  return weighted(
    [
      [[1], 50],
      [[0.5, 0.5], 42],
      [[1.5, 0.5], 8], // dotted-quarter + eighth spans two beats; handled by caller budget
    ] as const,
    rng,
  );
}

/**
 * Build a rhythm (array of beat durations) for a meter, with a sustained final
 * note. 4/4 → 2 measures (final note fills the rest of measure 2); 3/4 → 3
 * measures (measure 3 is a single dotted-half). Returns durations whose sum
 * equals the total beats and whose count is ≤ 9.
 */
function makeRhythm(meter: Meter, rng: () => number): number[] {
  if (meter === '3/4') {
    // M1 + M2 filled with beat cells (3 beats each), M3 = dotted half (3 beats).
    // Cap the body at 8 notes so the total (body + final) stays ≤ 9.
    const body = fillMeasures(2, 3, rng, 8);
    return capNotes([...body, 3], 9);
  }
  // 4/4: M1 filled (4 beats), M2 = some notes then a sustained final half note.
  // The final note is a half (2 beats) so measure 2 has 2 beats of movement,
  // biasing toward the preferred 8–9 total notes.
  const m1 = fillMeasure(4, rng);
  const finalLen = 2;
  const m2Body = fillMeasure(4 - finalLen, rng);
  const rhythm = [...m1, ...m2Body, finalLen];
  return capNotes(rhythm, 9);
}

/** Fill a single measure of `beats` with beat cells; returns durations summing to `beats`. */
function fillMeasure(beats: number, rng: () => number): number[] {
  const out: number[] = [];
  let remaining = beats;
  while (remaining >= 1) {
    const cell = beatCell(rng);
    const cellBeats = cell.reduce((s, b) => s + b, 0);
    if (cellBeats > remaining) {
      out.push(1);
      remaining -= 1;
    } else {
      out.push(...cell);
      remaining -= cellBeats;
    }
  }
  if (remaining > 0) out.push(remaining);
  return out;
}

/** Coarsen a rhythm by merging eighth-pairs into quarters until note count ≤ max. */
function capNotes(durations: number[], maxNotes: number): number[] {
  const out = [...durations];
  while (out.length > maxNotes) {
    const idx = out.findIndex((d, i) => d === 0.5 && out[i + 1] === 0.5);
    if (idx === -1) break;
    out.splice(idx, 2, 1);
  }
  return out;
}

/** Fill `count` measures of `beats` each, capping the total note count. */
function fillMeasures(count: number, beats: number, rng: () => number, maxNotes: number): number[] {
  let out: number[] = [];
  for (let i = 0; i < count; i += 1) out = out.concat(fillMeasure(beats, rng));
  return capNotes(out, maxNotes);
}

// ============================================================
// Contour (scale degrees)
// ============================================================

/** Pick the next degree from the current one using weighted stepwise-favoring motion. */
function nextDegree(current: number, rng: () => number): number {
  // Interval sizes (in scale steps) with signed direction; step favored.
  const size = weighted(
    [
      [1, 60], // 2nd
      [2, 22], // 3rd
      [3, 10], // 4th
      [4, 5], // 5th
      [0, 3], // repeat
    ] as const,
    rng,
  );
  if (size === 0) return current;
  const dir = rng() < 0.5 ? -1 : 1;
  let next = current + dir * size;
  // Keep within degrees 1..8.
  if (next < 1) next = current + size;
  if (next > 8) next = current - size;
  if (next < 1 || next > 8) next = current;
  return next;
}

/** Bias the final two notes toward a simple cadence ending on a stable degree. */
function cadence(rng: () => number): [number, number] {
  const finalDeg = weighted([[1, 75], [3, 10], [5, 15]] as const, rng);
  const approach = finalDeg === 1
    ? pick([2, 7, 3, 5], rng)
    : finalDeg === 3
      ? pick([2, 4], rng)
      : pick([4, 6], rng);
  return [approach, finalDeg];
}

/**
 * Generate a scale-degree contour of exactly `count` notes: a legal starting
 * degree, freely-moving middle notes, and a cadential final two notes
 * (`approach → finalDeg`, finalDeg stable). For very short melodies (count < 3)
 * the ending still lands on a stable final degree.
 */
function makeContour(count: number, rng: () => number): number[] {
  const [approach, finalDeg] = cadence(rng);

  if (count <= 1) return [finalDeg];
  if (count === 2) return [approach, finalDeg];

  const degrees: number[] = [pick(ALLOWED_START, rng)];
  // Fill the middle so that after appending [approach, finalDeg] the total is `count`.
  const middleCount = count - 3; // notes between the start and the cadence pair
  for (let i = 0; i < middleCount; i += 1) {
    degrees.push(nextDegree(degrees[degrees.length - 1], rng));
  }
  degrees.push(approach);
  degrees.push(finalDeg);
  return degrees;
}

// ============================================================
// Pitch conversion
// ============================================================

/** Choose a tonic octave so the melody sits comfortably on the treble staff. */
const TONIC_OCTAVE = 4;

/** Convert a degree note to a spelled pitch, applying the raised leading tone. */
function degreeToNote(key: PlaybackKey, d: DegreeNote): MelodyNote {
  if (d.raised && d.degree === 7) {
    return { pitch: raisedLeadingTone(key, TONIC_OCTAVE), beats: d.beats };
  }
  return { pitch: degreeToPitch(key, d.degree, TONIC_OCTAVE), beats: d.beats };
}

// ============================================================
// Validator
// ============================================================

const SUPPORTED_BEATS = new Set([0.5, 1, 1.5, 2, 3, 4]);

/** Bank melodies as pitch-class sequences, to reject near-duplicates. */
const BANK_SEQUENCES = PLAYBACK_BANK.map((q) => targetSequence(q.melody).join(','));

/** Validate a candidate against the hard rules. Returns true iff acceptable. */
export function validateQuestion(q: PlaybackQuestion): boolean {
  if (!PLAYBACK_KEYS.includes(q.key)) return false;
  if (q.meter !== '3/4' && q.meter !== '4/4') return false;
  if (q.melody.length < 1 || q.melody.length > 9) return false;
  if (q.melody.some((n) => !SUPPORTED_BEATS.has(n.beats))) return false;

  const totalBeats = q.melody.reduce((s, n) => s + n.beats, 0);
  const expected = q.meter === '3/4' ? 9 : 8;
  if (Math.abs(totalBeats - expected) > 0.001) return false;

  // Final note sustained: 3/4 ends on a dotted half; 4/4 ends on ≥ half.
  const last = q.melody[q.melody.length - 1];
  if (q.meter === '3/4' && last.beats !== 3) return false;
  if (q.meter === '4/4' && last.beats < 2) return false;

  // Ending must be a stable scale degree (tonic, mediant, or dominant): 0, 3/4,
  // or 7 semitones above the tonic pitch class (major/minor thirds both count).
  const info = keyInfo(q.key);
  const tonicPc = ((pitchToMidi(`${info.tonicLetter}4`) % 12) + 12) % 12;
  const lastPc = ((pitchToMidi(last.pitch) % 12) + 12) % 12;
  const endSemis = ((lastPc - tonicPc) + 12) % 12;
  if (![0, 3, 4, 7].includes(endSemis)) return false;

  // Not identical to a bank melody.
  const seq = targetSequence(q.melody).join(',');
  if (BANK_SEQUENCES.includes(seq)) return false;

  return true;
}

// ============================================================
// Generation
// ============================================================

/**
 * Generate one RCM Level 6 Playback question drawn from the allowed `keys`.
 * Regenerates until the candidate passes {@link validateQuestion} (capped, then
 * returns the last candidate defensively — the validator is expected to pass
 * well within the cap). Deterministic under a seeded `rng`.
 *
 * @param keys the allowed keys (defaults to all four)
 * @param rng  random source in [0,1); defaults to Math.random
 */
export function generateQuestion(
  keys: readonly PlaybackKey[] = PLAYBACK_KEYS,
  rng: () => number = Math.random,
): PlaybackQuestion {
  const pool = keys.length > 0 ? keys : PLAYBACK_KEYS;
  let last: PlaybackQuestion | null = null;

  for (let attempt = 0; attempt < 200; attempt += 1) {
    const key = pick(pool, rng);
    const meter: Meter = weighted([['4/4', 55], ['3/4', 45]] as const, rng);

    const rhythm = makeRhythm(meter, rng);
    if (rhythm.length > 9) continue;

    const degrees = makeContour(rhythm.length, rng);
    const isMinor = key === 'G minor' || key === 'E minor';

    const degreeNotes: DegreeNote[] = degrees.map((degree, i) => {
      // Raise the leading tone when degree 7 approaches the tonic near a cadence.
      const nextIsTonic = degrees[i + 1] === 1 || degrees[i + 1] === 8;
      const raised = isMinor && degree === 7 && (nextIsTonic || i === degrees.length - 2);
      return { degree, beats: rhythm[i], raised };
    });

    const melody = degreeNotes.map((d) => degreeToNote(key, d));
    const candidate: PlaybackQuestion = {
      id: `gen_${key.replace(' ', '_')}_${attempt}`,
      key,
      meter,
      tonic: tonicChord(key),
      melody,
    };
    last = candidate;
    if (validateQuestion(candidate)) return candidate;
  }

  // Defensive fallback: a minimal valid question (should never be reached).
  return last ?? {
    id: 'gen_fallback',
    key: 'G major',
    meter: '4/4',
    tonic: tonicChord('G major'),
    melody: [
      { pitch: degreeToPitch('G major', 1, TONIC_OCTAVE), beats: 1 },
      { pitch: degreeToPitch('G major', 2, TONIC_OCTAVE), beats: 1 },
      { pitch: degreeToPitch('G major', 3, TONIC_OCTAVE), beats: 1 },
      { pitch: degreeToPitch('G major', 2, TONIC_OCTAVE), beats: 1 },
      { pitch: degreeToPitch('G major', 1, TONIC_OCTAVE), beats: 2 },
      { pitch: degreeToPitch('G major', 1, TONIC_OCTAVE), beats: 2 },
    ],
  };
}
