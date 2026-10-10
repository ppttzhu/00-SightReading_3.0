/**
 * Playback random question generator.
 *
 * Produces a short, tonal, SINGABLE melody in scale degrees, then converts to
 * spelled pitches for the chosen key. "Singable" is enforced structurally, not
 * just by avoiding illegal intervals:
 *
 *   - rhythm is chosen first (as before), but measure/beat-position metadata is
 *     kept alongside each slot so pitch choice can react to barlines and
 *     eighth-note pairing;
 *   - pitch choice is NOT a one-step Markov walk. Each candidate melody is built
 *     with an explicit contour plan (start → climax → cadence), a per-melody
 *     interval budget, direction inertia, large-leap recovery, and range
 *     regression near the top/bottom of the tessitura;
 *   - many full candidates are generated, hard-invalid ones are discarded, the
 *     rest are scored for musicality, and the final melody is chosen randomly
 *     among the top-scoring slice (not always the single best) so repeated
 *     generation stays varied without being ugly.
 *
 * Hard syllabus rules are still enforced via {@link validateQuestion} with a
 * regenerate-on-failure fallback. Pure and framework-free (rng injectable).
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
  /** True when this note is the first note of a measure (crosses a barline). */
  startsMeasure: boolean;
}

/** Stable scale degrees (tonic triad), favored on long/strong-beat notes. */
const STABLE_DEGREES = new Set([1, 3, 5, 8]);
/** A "long" note worth treating as structurally stable (half note or longer). */
const LONG_NOTE_BEATS = 2;

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
// Rhythm (decided first, with measure-position metadata kept for later)
// ============================================================

/**
 * One rhythm slot with enough metric metadata to drive correct, beat-aware
 * beaming downstream (spec §7). This is INTERNAL to the generator; it is not
 * part of the public {@link PlaybackQuestion} (the renderer reconstructs
 * onsets from note durations + meter), but keeping it here makes onset
 * positions first-class and directly testable.
 */
interface RhythmSlot {
  beats: number;
  /** Zero-based measure index this note belongs to. */
  measureIndex: number;
  /** Zero-based beat offset of this note within its measure. */
  startBeat: number;
  /** True only for the first note of each measure. */
  startsMeasure: boolean;
}

/** Maximum notes in a complete melody (Playback upper bound). */
const MAX_MELODY_NOTES = 9;

// ------------------------------------------------------------
// Rhythm cells. A "cell" is a short group of durations that fills a fixed
// number of beats and never crosses a barline. We build measures by snapping
// cells together, so barline integrity is structural (we never merge or split
// across a boundary) rather than something `capNotes` has to repair afterward.
// ------------------------------------------------------------

/** A rhythm cell: durations (summing to `beats`) and whether it is dotted. */
interface RhythmCell {
  durations: number[];
  dotted: boolean;
}

/**
 * Non-dotted two-beat cells with their relative selection weights (spec §2).
 * Weights are preferences among eligible cells, not final appearance rates.
 */
const TWO_BEAT_PLAIN_CELLS: ReadonlyArray<readonly [number[], number]> = [
  [[1, 1], 30], // two quarters
  [[0.5, 0.5, 1], 20], // two eighths + quarter
  [[1, 0.5, 0.5], 20], // quarter + two eighths
  [[2], 5], // half note
];

/** The two dotted two-beat cells, favoring dotted-quarter → eighth 60:40 (spec §3). */
const TWO_BEAT_DOTTED_CELLS: ReadonlyArray<readonly [number[], number]> = [
  [[1.5, 0.5], 60], // dotted quarter + eighth
  [[0.5, 1.5], 40], // eighth + dotted quarter
];

/** One-beat cells (3/4 measures combine one 2-beat and one 1-beat cell). */
const ONE_BEAT_CELLS: ReadonlyArray<readonly [number[], number]> = [
  [[1], 60], // quarter (slightly preferred)
  [[0.5, 0.5], 40], // two eighths
];

/** Pick a non-dotted two-beat cell by weight. */
function pickPlainTwoBeatCell(rng: () => number): RhythmCell {
  return { durations: [...weighted(TWO_BEAT_PLAIN_CELLS, rng)], dotted: false };
}

/** Pick one of the two dotted two-beat cells by weight. */
function pickDottedTwoBeatCell(rng: () => number): RhythmCell {
  return { durations: [...weighted(TWO_BEAT_DOTTED_CELLS, rng)], dotted: true };
}

/** Pick a one-beat cell by weight (never dotted at this level). */
function pickOneBeatCell(rng: () => number): RhythmCell {
  return { durations: [...weighted(ONE_BEAT_CELLS, rng)], dotted: false };
}

/** Total note count a list of cells contributes. */
function cellNoteCount(cells: readonly RhythmCell[]): number {
  return cells.reduce((s, c) => s + c.durations.length, 0);
}

/**
 * Flatten ordered cells for one measure into tagged slots. `startBeat` is the
 * running onset within the measure (starts at 0), and only the first slot
 * opens the measure. Cells never cross a barline by construction, so these
 * onsets are exact.
 */
function cellsToMeasureSlots(cells: readonly RhythmCell[], measureIndex: number): RhythmSlot[] {
  const out: RhythmSlot[] = [];
  let startBeat = 0;
  for (const cell of cells) {
    for (const beats of cell.durations) {
      out.push({ beats, measureIndex, startBeat, startsMeasure: out.length === 0 });
      startBeat += beats;
    }
  }
  return out;
}

/**
 * Build the body of an exercise (everything except the fixed sustained final
 * note) as an ordered list of measures, each a list of cells. The caller
 * decides where (if anywhere) the single optional dotted cell goes.
 *
 * 4/4 body = measure 1 (two 2-beat cells) + measure 2 start (one 2-beat cell);
 *            the final half note is appended by {@link makeRhythm}.
 * 3/4 body = measure 1 and measure 2, each (one 2-beat cell + one 1-beat cell,
 *            in a randomized order); the final dotted half is appended later.
 *
 * `dottedSlotIndex`, when ≥ 0, is the index into the flat list of TWO-BEAT cell
 * positions that must carry the dotted cell; all other two-beat positions are
 * plain. When < 0, every cell is plain.
 */
function buildBodyMeasures(
  meter: Meter,
  dottedSlotIndex: number,
  rng: () => number,
): RhythmCell[][] {
  // Enumerate the two-beat cell positions in generation order so a single
  // chosen index maps to exactly one cell, keeping "at most one dotted" exact.
  let twoBeatSeen = 0;
  const makeTwoBeat = (): RhythmCell => {
    const isDotted = twoBeatSeen === dottedSlotIndex;
    twoBeatSeen += 1;
    return isDotted ? pickDottedTwoBeatCell(rng) : pickPlainTwoBeatCell(rng);
  };

  if (meter === '3/4') {
    const measure = (): RhythmCell[] => {
      // 3 beats = one 2-beat cell + one 1-beat cell, order randomized so the
      // dotted/longer cell is not always on the same beat (spec §5/§6).
      const two = makeTwoBeat();
      const one = pickOneBeatCell(rng);
      return rng() < 0.5 ? [two, one] : [one, two];
    };
    return [measure(), measure()];
  }

  // 4/4: measure 1 = two 2-beat cells; measure 2 body = one 2-beat cell.
  const m1 = [makeTwoBeat(), makeTwoBeat()];
  const m2Body = [makeTwoBeat()];
  return [m1, m2Body];
}

/** Count of two-beat cell POSITIONS available in the body for a meter. */
function twoBeatPositionCount(meter: Meter): number {
  return meter === '3/4' ? 2 : 3; // 3/4: one per measure; 4/4: 2 in M1 + 1 in M2
}

/**
 * Build a rhythm (array of {@link RhythmSlot}) for a meter, with a sustained
 * final note.
 *
 *   - 4/4 → 2 measures (8 beats); measure 2 ends with a fixed half note.
 *   - 3/4 → 3 measures (9 beats); measure 3 is a single mandatory dotted half.
 *
 * Dotted-rhythm policy (spec §3): a question-level flag gives ~40% of exercises
 * exactly ONE optional dotted-quarter cell (`[1.5,0.5]` or `[0.5,1.5]`) placed
 * at a randomized two-beat position in the body; the other ~60% contain none.
 * The mandatory 3/4 final dotted half is NOT an "optional" dotted note and is
 * added separately, so it never counts toward that budget.
 *
 * The optional dotted cell is chosen up front and threaded through generation,
 * so it is guaranteed to survive into the result — it is never introduced or
 * removed by any post-processing. If a layout would exceed the 9-note limit we
 * regenerate (keeping the same dotted flag) instead of merging notes, which
 * could otherwise silently delete the dotted cell.
 *
 * `useDottedRhythm` is decided ONCE PER QUESTION by {@link generateQuestion}
 * and passed down unchanged to every candidate (spec §3/§11), so the ~40%
 * question-level rate is exact rather than an emergent average that scoring
 * and top-slice selection could skew.
 */
function makeRhythm(meter: Meter, useDottedRhythm: boolean, rng: () => number): RhythmSlot[] {
  const positions = twoBeatPositionCount(meter);

  // Regenerate until the body fits the note-count budget. The budget is easy to
  // satisfy, so this loop almost always succeeds on the first pass; the cap is
  // only a safety net against a pathological RNG.
  const maxBodyNotes = MAX_MELODY_NOTES - 1; // reserve one slot for the final note
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const dottedSlotIndex = useDottedRhythm ? Math.floor(rng() * positions) : -1;
    const bodyMeasures = buildBodyMeasures(meter, dottedSlotIndex, rng);
    const bodyNotes = bodyMeasures.reduce((s, m) => s + cellNoteCount(m), 0);
    if (bodyNotes > maxBodyNotes) continue;

    const slots: RhythmSlot[] = [];
    bodyMeasures.forEach((measureCells, mi) => {
      slots.push(...cellsToMeasureSlots(measureCells, mi));
    });

    // Append the fixed sustained final note with correct metadata.
    //   - 4/4: the final half note closes measure 2 (measureIndex 1) on beat 2.
    //     The body always contributes one 2-beat cell to measure 2, so the
    //     final note never opens the measure.
    //   - 3/4: the final dotted half is its own measure (measureIndex 2) and
    //     always opens it, on beat 0.
    if (meter === '4/4') {
      slots.push({ beats: 2, measureIndex: 1, startBeat: 2, startsMeasure: false });
    } else {
      slots.push({ beats: 3, measureIndex: 2, startBeat: 0, startsMeasure: true });
    }
    return slots;
  }

  // Pathological fallback: simplest valid rhythm honoring the dotted flag.
  return fallbackRhythm(meter, useDottedRhythm);
}

/**
 * Deterministic, always-valid rhythm used only if the bounded retry loop in
 * {@link makeRhythm} somehow never finds a fitting layout. Honors the dotted
 * flag (spec §11: a fallback must not silently drop a dotted-enabled question
 * to non-dotted) and carries full metric metadata like a normal rhythm.
 */
function fallbackRhythm(meter: Meter, useDottedRhythm: boolean): RhythmSlot[] {
  if (meter === '3/4') {
    const m0: RhythmCell[] = useDottedRhythm
      ? [{ durations: [1.5, 0.5], dotted: true }, { durations: [1], dotted: false }]
      : [{ durations: [1, 1], dotted: false }, { durations: [1], dotted: false }];
    const m1: RhythmCell[] = [{ durations: [1, 1], dotted: false }, { durations: [1], dotted: false }];
    return [
      ...cellsToMeasureSlots(m0, 0),
      ...cellsToMeasureSlots(m1, 1),
      { beats: 3, measureIndex: 2, startBeat: 0, startsMeasure: true },
    ];
  }
  const m0: RhythmCell[] = useDottedRhythm
    ? [{ durations: [1.5, 0.5], dotted: true }, { durations: [1, 1], dotted: false }]
    : [{ durations: [1, 1], dotted: false }, { durations: [1, 1], dotted: false }];
  const m1Body: RhythmCell[] = [{ durations: [1, 1], dotted: false }];
  return [
    ...cellsToMeasureSlots(m0, 0),
    ...cellsToMeasureSlots(m1Body, 1),
    { beats: 2, measureIndex: 1, startBeat: 2, startsMeasure: false },
  ];
}

// ============================================================
// Contour (scale degrees) — plan-then-build, not a Markov walk
// ============================================================

/** Pick the melody's final (stable) degree: tonic, mediant, or dominant. */
function pickFinalDegree(rng: () => number): number {
  return weighted([[1, 75], [3, 10], [5, 15]] as const, rng);
}

/**
 * Pick the note(s) approaching the final degree, biased toward the melody's
 * recent direction so the cadence feels like a continuation of the phrase
 * rather than an independently-rolled ending (reviewer point 3). Common
 * natural approaches are weighted higher than a flat uniform choice:
 *   - into 1: 2→1 (descending resolution) and 7→1 (leading tone) are the most
 *     natural; a 3→2→1 three-note descent is offered when `precedingDir`
 *     is downward and there is room for an extra note; 5→1 (a 4th leap) and
 *     3→1 remain available but lightly weighted since they are leaps.
 *   - into 3 / 5: step or 3rd approaches only (no large leaps into a cadence).
 *
 * @param finalDeg      the chosen final degree
 * @param precedingDir  net direction (-1 down, 0 flat, 1 up) of the melody so
 *                      far, used to favor a same-direction approach
 * @param allowTriNote  if true and useful, may return a 2-note approach
 *                      (handled by the caller truncating `extra` when there's
 *                      no room); the second element is only used in that case
 */
function cadenceApproach(
  finalDeg: number,
  precedingDir: -1 | 0 | 1,
  allowTriNote: boolean,
  rng: () => number,
): { approach: number; extra: number | null } {
  if (finalDeg === 1) {
    const descending = precedingDir !== 1; // favor a descending approach unless the phrase was clearly rising
    const options: Array<readonly [{ approach: number; extra: number | null }, number]> = [
      [{ approach: 2, extra: null }, descending ? 34 : 20], // 2 -> 1, stepwise descent
      [{ approach: 7, extra: null }, 26], // 7 -> 1, leading tone (near-mandatory feel via high weight)
      [{ approach: 5, extra: null }, 10], // 5 -> 1, leap but common
      [{ approach: 3, extra: null }, 10], // 3 -> 1
    ];
    if (allowTriNote && descending) {
      options.push([{ approach: 2, extra: 3 }, 20]); // 3 -> 2 -> 1 stepwise descent
    }
    return weighted(options, rng);
  }
  if (finalDeg === 3) return { approach: pick([2, 4], rng), extra: null };
  return { approach: pick([4, 6], rng), extra: null }; // finalDeg === 5
}

/** Unsigned diatonic interval sizes available when choosing the next degree. */
type IntervalSize = 1 | 2 | 3 | 4;

/** Running state threaded through contour construction for one candidate. */
interface ContourState {
  /** -1 down, 0 flat/repeat, 1 up — direction of the most recent non-repeat step. */
  direction: -1 | 0 | 1;
  /** How many times direction has changed so far (repeats don't count). */
  directionChanges: number;
  /** True if the previous transition was a leap (3rd or larger). */
  prevWasLeap: boolean;
  /** Unsigned size of the previous transition (0 = repeat). */
  prevSize: number;
  /** Remaining budget for stepwise transitions. */
  stepsLeft: number;
  /** Remaining budget for 3rds. */
  thirdsLeft: number;
  /** Remaining budget for 4ths. */
  fourthsLeft: number;
  /** Remaining budget for 5ths. */
  fifthsLeft: number;
  /** True once a 4th-or-larger leap has been used (adjacency guard). */
  usedLargeLeap: boolean;
}

/**
 * Build the interval budget for an N-note melody (musicality rule 3). Targets
 * roughly 4-6 stepwise transitions, 1-2 thirds, and at most one 4th and one
 * 5th, scaled down a little for shorter melodies.
 */
function makeBudget(count: number): Pick<ContourState, 'stepsLeft' | 'thirdsLeft' | 'fourthsLeft' | 'fifthsLeft'> {
  return {
    stepsLeft: Math.max(3, Math.round(count * 0.55)),
    thirdsLeft: 2,
    fourthsLeft: 1,
    fifthsLeft: 1,
  };
}

/**
 * Choose the next scale degree from `current`, given contour state and a
 * target degree to arc toward. Degrees stay within 1..8 AND within
 * `[floorDeg, ceilDeg]` when provided — this is what lets the caller
 * guarantee the climax is never exceeded before its planned position (see
 * {@link makeContourCandidate}). Mutates `state` in place to track
 * budget/direction/leap-recovery.
 */
function nextDegree(
  current: number,
  state: ContourState,
  rng: () => number,
  opts: { targetDegree: number; floorDeg?: number; ceilDeg?: number },
): number {
  const lo = Math.max(1, opts.floorDeg ?? 1);
  const hi = Math.min(8, opts.ceilDeg ?? 8);

  // Mandatory (near-)recovery after a large leap (4th/5th): strongly prefer an
  // opposite-direction step. This implements "large leap -> opposite step".
  if (state.prevWasLeap && state.prevSize >= 3) {
    const oppositeDir = -state.direction as -1 | 0 | 1;
    const stepTarget = current + oppositeDir * 1;
    if (stepTarget >= lo && stepTarget <= hi && rng() < 0.85) {
      return stepTarget;
    }
  }

  // Candidate interval sizes still inside budget, biased toward the register
  // target and away from exhausting the large-leap allowance.
  const sizeWeights: Array<readonly [IntervalSize, number]> = [];
  if (state.stepsLeft > 0) sizeWeights.push([1, 62]);
  if (state.thirdsLeft > 0) sizeWeights.push([2, 24]);
  // 4ths/5ths: never adjacent to another large leap, and only while budget remains.
  if (state.fourthsLeft > 0 && !state.usedLargeLeap) sizeWeights.push([3, 8]);
  if (state.fifthsLeft > 0 && !state.usedLargeLeap) sizeWeights.push([4, 4]);
  if (sizeWeights.length === 0) sizeWeights.push([1, 1]); // budget exhausted: fall back to steps

  // Direction choice: step inertia (favor continuing current direction) plus a
  // pull toward the target degree and regression away from range extremes.
  const towardTarget = opts.targetDegree > current ? 1 : opts.targetDegree < current ? -1 : 0;
  let upWeight = 50;
  let downWeight = 50;
  if (state.direction === 1) { upWeight += 22; downWeight -= 12; }
  if (state.direction === -1) { downWeight += 22; upWeight -= 12; }
  if (towardTarget === 1) upWeight += 18;
  if (towardTarget === -1) downWeight += 18;
  // Range regression: near the top of the allowed range, favor down; near the
  // bottom, favor up (uses the active floor/ceiling, not just the absolute 1..8).
  if (current >= hi - 1) { downWeight += 40; upWeight -= 25; }
  else if (current <= lo + 1) { upWeight += 40; downWeight -= 25; }
  upWeight = Math.max(upWeight, 5);
  downWeight = Math.max(downWeight, 5);

  for (let tries = 0; tries < 8; tries += 1) {
    const size = weighted(sizeWeights, rng);
    const dir: -1 | 1 = rng() * (upWeight + downWeight) < upWeight ? 1 : -1;
    const next = current + dir * size;
    if (next < lo || next > hi) continue; // out of the allowed range, retry with a new draw
    return next;
  }
  // Couldn't find anything in range after a few tries: safe fallback (repeat/step).
  const mid = (lo + hi) / 2;
  const fallbackDir: -1 | 1 = current >= mid ? -1 : 1;
  const fallback = current + fallbackDir;
  return fallback >= lo && fallback <= hi ? fallback : current;
}

/** Apply the outcome of a chosen transition to the running contour state. */
function applyTransition(state: ContourState, from: number, to: number): void {
  const diff = to - from;
  const size = Math.abs(diff);
  const dir: -1 | 0 | 1 = diff === 0 ? 0 : diff > 0 ? 1 : -1;

  if (dir !== 0 && state.direction !== 0 && dir !== state.direction) state.directionChanges += 1;
  if (dir !== 0) state.direction = dir;

  if (size === 1) state.stepsLeft = Math.max(0, state.stepsLeft - 1);
  else if (size === 2) state.thirdsLeft = Math.max(0, state.thirdsLeft - 1);
  else if (size === 3) { state.fourthsLeft = Math.max(0, state.fourthsLeft - 1); state.usedLargeLeap = true; }
  else if (size >= 4) { state.fifthsLeft = Math.max(0, state.fifthsLeft - 1); state.usedLargeLeap = true; }

  // The "no two large leaps adjacent" guard only blocks the *immediately*
  // following transition; clear it once a step/third has intervened.
  if (size <= 2) state.usedLargeLeap = false;

  state.prevWasLeap = size >= 2;
  state.prevSize = size;
}

/**
 * Generate one candidate scale-degree contour of exactly `count` notes, built
 * as plan-then-build (rule 15/16), with the climax ENFORCED rather than
 * merely biased toward (reviewer point 1):
 *
 *   1. Choose a start, a cadence (final degree + natural approach, aware of
 *      the melody's overall direction), and an interval budget.
 *   2. Choose a climax degree and the exact note INDEX it must occur at,
 *      restricted to roughly the 40%-75% span of the melody.
 *   3. Phase A (start -> climax): build notes up to the climax index with a
 *      ceiling/floor that forbids crossing the climax degree early, then
 *      force the climax index itself to land exactly on the climax degree.
 *   4. Phase B (climax -> cadence): build the remaining notes with the
 *      opposite ceiling/floor (so the melody can't re-exceed the climax)
 *      while arcing back toward the cadence approach note.
 */
function makeContourCandidate(count: number, rng: () => number): number[] {
  if (count <= 1) return [pickFinalDegree(rng)];

  // The climax is always the melody's single HIGH point (reviewer point 1 /
  // rules 12-13): one principal apex, reached in the middle/later-middle, then
  // a return toward the cadence. We therefore never start on the ceiling
  // (degree 8) — the arch needs room to rise to a peak that comes later.
  const start = pick([1, 3, 5] as const, rng);
  // Climax sits above the start by at least a third so the apex is audible and
  // isn't trivially the opening note.
  const climaxDegree = weighted(
    ([[5, 24], [6, 30], [7, 22], [8, 24]] as const).filter(([d]) => d >= start + 2),
    rng,
  );

  // After the apex the melody descends toward the cadence, so the motion
  // feeding the final note is downward — bias the cadence approach to the
  // natural descending resolutions (2->1, 3->2->1).
  const precedingDir: -1 | 0 | 1 = -1;
  const finalDeg = pickFinalDegree(rng);
  const hasRoomForTriNoteCadence = count >= 5;
  const { approach, extra } = cadenceApproach(finalDeg, precedingDir, hasRoomForTriNoteCadence, rng);
  // Cadence tail: either [approach, finalDeg] or [extra, approach, finalDeg].
  const cadenceTail = extra !== null ? [extra, approach, finalDeg] : [approach, finalDeg];

  if (count === 2) return [finalDeg];
  if (count <= cadenceTail.length) return cadenceTail.slice(cadenceTail.length - count);

  const middleCount = count - 1 - cadenceTail.length; // notes strictly between start and the cadence tail

  // Place the climax within roughly the 40%-75% span of the WHOLE melody
  // (index 0 = start), clamped so it always falls inside the middle section.
  const climaxIndex = middleCount > 0
    ? Math.min(
      1 + middleCount, // last usable middle slot (1-indexed within [1..middleCount])
      Math.max(1, Math.round(count * (0.4 + rng() * 0.35))),
    )
    : 0;

  const degrees: number[] = [start];
  const state: ContourState = {
    direction: 0,
    directionChanges: 0,
    prevWasLeap: false,
    prevSize: 0,
    usedLargeLeap: false,
    ...makeBudget(count),
  };

  // The climax is the melody's high point: nothing before OR after it may
  // exceed `climaxDegree`, which guarantees a single clear apex (rule 13).
  const ceilDeg = climaxDegree;

  // Phase A: start -> climax (exclusive of the climax note itself), capped so
  // the melody cannot exceed the climax degree before reaching it.
  for (let i = 1; i < climaxIndex && i <= middleCount; i += 1) {
    const cur = degrees[degrees.length - 1];
    const next = nextDegree(cur, state, rng, {
      targetDegree: climaxDegree,
      floorDeg: 1,
      ceilDeg,
    });
    applyTransition(state, cur, next);
    degrees.push(next);
  }

  // Force the climax note itself (only if it falls within the middle section;
  // for very short melodies the cadence tail already carries the ending).
  if (climaxIndex >= 1 && climaxIndex <= middleCount) {
    const cur = degrees[degrees.length - 1];
    applyTransition(state, cur, climaxDegree);
    degrees.push(climaxDegree);
  }

  // Phase B: climax -> cadence approach, capped so the melody regresses back
  // toward the center instead of re-exceeding the climax.
  const postClimaxTarget = cadenceTail[0];
  for (let i = degrees.length; i < 1 + middleCount; i += 1) {
    const cur = degrees[degrees.length - 1];
    const next = nextDegree(cur, state, rng, {
      targetDegree: postClimaxTarget,
      floorDeg: 1,
      ceilDeg,
    });
    applyTransition(state, cur, next);
    degrees.push(next);
  }

  return [...degrees, ...cadenceTail];
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
// Validator (hard rules)
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

  // Melodic-interval legality (semitone-based, catches augmented/diminished
  // intervals such as the minor-mode augmented 2nd between lowered 6 and
  // raised 7): no melodic interval should exceed a perfect 5th (7 semitones),
  // and no interval should be an augmented 2nd/4th or diminished interval.
  for (let i = 1; i < q.melody.length; i += 1) {
    const prevMidi = pitchToMidi(q.melody[i - 1].pitch);
    const curMidi = pitchToMidi(q.melody[i].pitch);
    const semis = Math.abs(curMidi - prevMidi);
    if (semis > 7) return false; // bigger than a perfect 5th: not allowed at all
    if (semis === 6 && q.melody[i - 1].pitch[0] !== q.melody[i].pitch[0]) {
      // A bare tritone (augmented 4th / diminished 5th) step is avoided; the
      // only semitone=6 case allowed would be an enharmonic same-letter spelling,
      // which doesn't occur in this diatonic generator, so reject outright.
      return false;
    }
  }

  // Not identical to a bank melody.
  const seq = targetSequence(q.melody).join(',');
  if (BANK_SEQUENCES.includes(seq)) return false;

  return true;
}

// ============================================================
// Musicality scoring (soft rules, rule 17)
// ============================================================

/** Per-note metadata needed for scoring, aligned with the melody array. */
interface ScoreContext {
  degrees: number[];
  beats: number[];
  startsMeasure: boolean[];
}

/**
 * Reward motivic repetition (reviewer point 4): a melody that restates the same
 * short interval "shape" at a different pitch level sounds composed rather than
 * like a note-by-note stepwise drift. A "shape" is the sequence of signed
 * diatonic intervals over a window of `n` notes (so `n` notes → `n-1`
 * intervals). We look for two groups of `n` notes whose interval shapes match
 * (e.g. 1-2-3 and 2-3-4 both have shape [+1,+1], and 1-2-3 then 3-2-1 is a
 * mirror we also lightly reward).
 *
 * Rules applied:
 *   - exact transposed repetition (same signed intervals) is worth the most;
 *   - a strict inversion (mirrored direction) is worth a little;
 *   - a trivially flat shape (all repeats, e.g. [0,0]) is ignored so a static
 *     melody can't farm this bonus;
 *   - groups may start anywhere but we only credit the first repeated pair per
 *     window length, capping the total so one motif doesn't dominate the score.
 *
 * @param degrees the full scale-degree contour
 * @param n       notes per motif window (3 or 4)
 * @returns a non-negative bonus to add to the musicality score
 */
function motivicRepetitionBonus(degrees: number[], n: number): number {
  if (degrees.length < n * 2) return 0;

  // Precompute signed intervals between adjacent degrees.
  const intervals: number[] = [];
  for (let i = 1; i < degrees.length; i += 1) intervals.push(degrees[i] - degrees[i - 1]);

  const shapeLen = n - 1; // intervals per window
  // A window's shape is intervals[start .. start+shapeLen-1].
  const shapeAt = (start: number): number[] => intervals.slice(start, start + shapeLen);
  const isFlat = (shape: number[]): boolean => shape.every((v) => v === 0);
  const equal = (a: number[], b: number[]): boolean => a.length === b.length && a.every((v, i) => v === b[i]);
  const inverted = (a: number[], b: number[]): boolean =>
    a.length === b.length && a.every((v, i) => v === -b[i]);

  // Compare every pair of non-overlapping windows; take the best single match
  // so one strong motif is rewarded without stacking many overlapping credits.
  let best = 0;
  const lastStart = intervals.length - shapeLen;
  for (let a = 0; a + shapeLen <= intervals.length; a += 1) {
    const shapeA = shapeAt(a);
    if (isFlat(shapeA)) continue;
    for (let b = a + shapeLen; b <= lastStart; b += 1) {
      const shapeB = shapeAt(b);
      if (equal(shapeA, shapeB)) best = Math.max(best, n >= 4 ? 4 : 3);
      else if (inverted(shapeA, shapeB)) best = Math.max(best, 2);
    }
  }
  return best;
}

/** Score one candidate melody for musicality. Higher is better. */
function scoreMelody(ctx: ScoreContext): number {
  const { degrees, beats, startsMeasure } = ctx;
  let score = 0;
  let directionChanges = 0;
  let prevDir: -1 | 0 | 1 = 0;
  let consecutiveSkips = 0; // 3rd-or-larger run length
  let largeLeapCount = 0;
  const usedRangeMin = Math.min(...degrees);
  const usedRangeMax = Math.max(...degrees);

  for (let i = 1; i < degrees.length; i += 1) {
    const from = degrees[i - 1];
    const to = degrees[i];
    const diff = to - from;
    const size = Math.abs(diff);
    const dir: -1 | 0 | 1 = diff === 0 ? 0 : diff > 0 ? 1 : -1;
    const isLargeLeap = size >= 3; // 4th or bigger
    const isSkip = size >= 2; // 3rd or bigger

    // Interval-size base score.
    if (size === 1) score += 3;
    else if (size === 2) score += 1.5;
    else if (size === 3) score -= 2;
    else if (size >= 4) score -= 4;

    // Large-leap recovery / consecutive-leap penalty.
    if (isLargeLeap) {
      largeLeapCount += 1;
      const prevFrom = i >= 2 ? degrees[i - 2] : null;
      const prevSize = prevFrom === null ? 0 : Math.abs(from - prevFrom);
      if (prevSize >= 3) score -= 10; // consecutive large leaps
      // Reward opposite-direction step immediately following a large leap.
      if (i + 1 < degrees.length) {
        const nextDiff = degrees[i + 1] - to;
        if (Math.sign(nextDiff) === -dir && Math.abs(nextDiff) === 1) score += 4;
      }
    }

    // Skip-run tracking (rule 17: -5 for three consecutive skips/leaps).
    if (isSkip) { consecutiveSkips += 1; if (consecutiveSkips >= 3) score -= 5; }
    else consecutiveSkips = 0;

    // Direction-change tracking for zig-zag / excessive-change penalties.
    if (dir !== 0) {
      if (prevDir !== 0 && dir !== prevDir) directionChanges += 1;
      prevDir = dir;
    }

    // Barline smoothness: the transition INTO a note that starts a new measure.
    if (startsMeasure[i]) {
      if (size <= 1) score += 4;
      else if (size === 2) score += 1;
      else score -= 4;
    }

    // Eighth-pair rhythmic-melodic coordination (rule 14): look at pairs of
    // consecutive eighth notes within the same beat-ish grouping (both 0.5).
    if (beats[i - 1] === 0.5 && beats[i] === 0.5) {
      if (size <= 2) score += 1; // step/third pairing is smooth
      else score -= 3; // leap hidden inside fast notes
    }
  }

  // Passing-tone / neighbor-tone three-note patterns (rule 7).
  for (let i = 2; i < degrees.length; i += 1) {
    const a = degrees[i - 2];
    const b = degrees[i - 1];
    const c = degrees[i];
    const stepUp = b - a === 1 && c - b === 1;
    const stepDown = b - a === -1 && c - b === -1;
    if (stepUp || stepDown) score += 2; // passing tone
    if (a === c && Math.abs(b - a) === 1) score += 2; // neighbor tone (upper or lower)
  }

  // Motivic repetition (reviewer point 4): reward a melody that reuses the
  // same short interval "shape" (e.g. two consecutive 3-note groups that both
  // move +1,+1, as in 1-2-3 | 2-3-4) rather than only ever favoring the most
  // stepwise option note-by-note. This is a soft bonus, not a requirement, so
  // melodies without a repeated motif are not penalized.
  score += motivicRepetitionBonus(degrees, 3);
  score += motivicRepetitionBonus(degrees, 4);

  // Direction-change count: prefer roughly 1-3 meaningful changes (rule 1).
  if (directionChanges >= 1 && directionChanges <= 3) score += 2;
  else if (directionChanges > 3) score -= (directionChanges - 3) * 1;
  else if (directionChanges === 0 && degrees.length > 4) score -= 1; // too flat/monotone

  // Zig-zag detection: alternating up/down almost every note across a long run.
  let alternations = 0;
  let lastDir: -1 | 0 | 1 = 0;
  for (let i = 1; i < degrees.length; i += 1) {
    const d = degrees[i] - degrees[i - 1];
    const dir: -1 | 0 | 1 = d === 0 ? 0 : d > 0 ? 1 : -1;
    if (dir !== 0 && lastDir !== 0 && dir === -lastDir && Math.abs(d) >= 2) alternations += 1;
    if (dir !== 0) lastDir = dir;
  }
  if (alternations >= 2) score -= 5;

  // Structural/strong-beat notes: long notes should land on stable degrees (rule 6/11).
  for (let i = 0; i < degrees.length; i += 1) {
    if (beats[i] >= LONG_NOTE_BEATS && STABLE_DEGREES.has(((degrees[i] - 1) % 7) + 1)) score += 3;
    else if (beats[i] >= LONG_NOTE_BEATS) score -= 1;
  }

  // Repeated extreme notes (rule 13/17): penalize bouncing to the same max/min repeatedly.
  const maxCount = degrees.filter((d) => d === usedRangeMax).length;
  const minCount = degrees.filter((d) => d === usedRangeMin).length;
  if (maxCount > 2) score -= 3 * (maxCount - 2);
  if (minCount > 2) score -= 3 * (minCount - 2);
  if (maxCount === 1) score += 3; // exactly one clear climax

  // Range usage: penalize melodies that span nearly the full available range
  // without melodic justification (more than one large leap already penalized above).
  const span = usedRangeMax - usedRangeMin;
  if (span >= 7 && largeLeapCount >= 2) score -= 5;

  // Cadence / final tonic.
  const finalDegree = ((degrees[degrees.length - 1] - 1) % 7) + 1;
  if (finalDegree === 1) score += 5;
  score += 5; // clear cadence shape is already enforced by validateQuestion's ending check

  return score;
}

// ============================================================
// Candidate generation + selection (rules 15-19)
// ============================================================

const CANDIDATES_PER_QUESTION = 48;
/** Fraction of valid, sorted candidates to randomly choose among (top slice). */
const TOP_SLICE_FRACTION = 0.2;

/** One fully-built candidate melody plus its scoring context. */
interface Candidate {
  question: PlaybackQuestion;
  score: number;
}

/**
 * Build one full candidate (rhythm + contour + pitches) for a key/meter pick.
 * `useDottedRhythm` is fixed per question and passed through so every candidate
 * shares the same dotted decision (spec §11).
 */
function buildCandidate(
  key: PlaybackKey,
  meter: Meter,
  attemptTag: number,
  useDottedRhythm: boolean,
  rng: () => number,
): Candidate | null {
  const rhythm = makeRhythm(meter, useDottedRhythm, rng);
  if (rhythm.length > 9 || rhythm.length < 1) return null;

  const degrees = makeContourCandidate(rhythm.length, rng);
  const isMinor = key === 'G minor' || key === 'E minor';

  const degreeNotes: DegreeNote[] = degrees.map((degree, i) => {
    // Raise the leading tone when degree 7 approaches the tonic near a cadence
    // (rule 9: context-sensitive leading tone, not a global 7->1 rule).
    const nextIsTonic = degrees[i + 1] === 1 || degrees[i + 1] === 8;
    const nearEnd = i >= degrees.length - 2;
    const raised = isMinor && degree === 7 && (nextIsTonic || nearEnd);
    return { degree, beats: rhythm[i].beats, raised, startsMeasure: rhythm[i].startsMeasure };
  });

  const melody = degreeNotes.map((d) => degreeToNote(key, d));
  const question: PlaybackQuestion = {
    id: `gen_${key.replace(' ', '_')}_${attemptTag}`,
    key,
    meter,
    tonic: tonicChord(key),
    melody,
  };

  if (!validateQuestion(question)) return null;

  const score = scoreMelody({
    degrees,
    beats: degreeNotes.map((d) => d.beats),
    startsMeasure: degreeNotes.map((d) => d.startsMeasure),
  });

  return { question, score };
}

/**
 * Generate one Playback question drawn from the allowed `keys`.
 *
 * Builds a pool of candidate melodies (plan-then-build contour, not a Markov
 * chain), discards hard-invalid ones, scores the rest for musicality, and
 * returns a randomly-chosen question among the top-scoring slice. Falls back
 * to best-effort single-candidate generation if the pool comes up empty
 * (extremely unlikely), then to a hardcoded melody as a last resort.
 * Deterministic under a seeded `rng`.
 *
 * @param keys the allowed keys (defaults to all four)
 * @param rng  random source in [0,1); defaults to Math.random
 */
export function generateQuestion(
  keys: readonly PlaybackKey[] = PLAYBACK_KEYS,
  rng: () => number = Math.random,
): PlaybackQuestion {
  const pool = keys.length > 0 ? keys : PLAYBACK_KEYS;

  // Fix key/meter once per question (as before), then generate many pitch/rhythm
  // candidates for that key/meter so scoring compares like with like.
  const key = pick(pool, rng);
  const meter: Meter = weighted([['4/4', 55], ['3/4', 45]] as const, rng);
  // Decide the optional-dotted flag ONCE per question (spec §3/§11): every
  // candidate shares it, so the ~40% rate is exact and unaffected by scoring
  // or top-slice selection.
  const useDottedRhythm = rng() < 0.4;

  const candidates: Candidate[] = [];
  for (let attempt = 0; attempt < CANDIDATES_PER_QUESTION; attempt += 1) {
    const candidate = buildCandidate(key, meter, attempt, useDottedRhythm, rng);
    if (candidate) candidates.push(candidate);
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    const sliceSize = Math.max(1, Math.round(candidates.length * TOP_SLICE_FRACTION));
    const top = candidates.slice(0, sliceSize);
    return pick(top, rng).question;
  }

  // Extremely unlikely fallback: retry with fresh key/meter picks one at a time
  // until something validates, capped to avoid an infinite loop. The original
  // dotted flag is preserved (spec §11) so a fallback can't silently drop a
  // dotted-enabled question down to a non-dotted one.
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const fallbackKey = pick(pool, rng);
    const fallbackMeter: Meter = weighted([['4/4', 55], ['3/4', 45]] as const, rng);
    const candidate = buildCandidate(fallbackKey, fallbackMeter, 1000 + attempt, useDottedRhythm, rng);
    if (candidate) return candidate.question;
  }

  // Defensive fallback: a minimal valid question (should never be reached).
  return {
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
