/**
 * Octave-agnostic melody matching for MIDI playback input.
 *
 * The student plays the melody on a MIDI keyboard; we compare the sequence of
 * pitch CLASSES (0..11, octave ignored) they play against the question's melody
 * pitch classes, in order. Rhythm is ignored. This module is pure and
 * framework-free.
 */

import type { MelodyNote } from './playbackTypes';
import { pitchToMidi } from './playbackKeys';

/** The pitch class (0..11) of a spelled pitch. */
export function pitchClassOf(pitch: string): number {
  return ((pitchToMidi(pitch) % 12) + 12) % 12;
}

/** The target pitch-class sequence for a melody. */
export function targetSequence(melody: MelodyNote[]): number[] {
  return melody.map((n) => pitchClassOf(n.pitch));
}

/**
 * Progress of a played sequence against the target, ignoring octave.
 *
 * `matchedCount` is how many leading notes are correct so far; `status` is:
 * - `'in-progress'` — the played prefix matches and is shorter than the target;
 * - `'complete'` — the full melody was played correctly, in order;
 * - `'wrong'` — the most recent note broke the match (does not equal the
 *   expected pitch class at that position).
 */
export interface MatchState {
  matchedCount: number;
  status: 'in-progress' | 'complete' | 'wrong';
}

/**
 * Evaluate a played pitch-class sequence against the target. Matching is strict
 * and positional: note `i` must equal `target[i]`. The first mismatch yields
 * `'wrong'`; a full correct sequence yields `'complete'`.
 *
 * @param played the pitch classes played so far, in order
 * @param target the melody's target pitch classes
 */
export function evaluateSequence(played: number[], target: number[]): MatchState {
  const n = Math.min(played.length, target.length);
  for (let i = 0; i < n; i += 1) {
    if (played[i] !== target[i]) return { matchedCount: i, status: 'wrong' };
  }
  if (played.length > target.length) {
    // Extra notes beyond a fully-correct melody count as wrong.
    return { matchedCount: target.length, status: 'wrong' };
  }
  if (played.length === target.length) return { matchedCount: target.length, status: 'complete' };
  return { matchedCount: played.length, status: 'in-progress' };
}
