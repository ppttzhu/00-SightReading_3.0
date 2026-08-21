/**
 * Shared types for the RCM Level 6 Playback exercise.
 *
 * A Playback question is a short tonal melody in one of four keys, preceded by
 * a tonic chord. The student hears the tonic chord once and the melody (played
 * on demand), then reproduces the melody. This module is pure and
 * framework-free.
 */

/** The four supported RCM Level 6 Playback keys. */
export type PlaybackKey = 'G major' | 'E major' | 'G minor' | 'E minor';

/** The four keys in canonical display order. */
export const PLAYBACK_KEYS: readonly PlaybackKey[] = [
  'G major',
  'E major',
  'G minor',
  'E minor',
];

/** Supported meters (time signatures). */
export type Meter = '3/4' | '4/4';

/** One melody note: a spelled pitch (letter+accidental+octave) and a beat duration. */
export interface MelodyNote {
  /** Spelled pitch, e.g. "F#4", "Bb4", "G5". Source of truth for the note name. */
  pitch: string;
  /** Duration in beats (quarter = 1, eighth = 0.5, half = 2, dotted-half = 3, …). */
  beats: number;
}

/**
 * A fully-specified Playback question: everything needed to display, play, and
 * grade one exercise.
 */
export interface PlaybackQuestion {
  /** Stable id (bank questions use their source file id; generated ones a synthetic id). */
  id: string;
  /** The key of the exercise. */
  key: PlaybackKey;
  /** The meter. */
  meter: Meter;
  /** The tonic chord's four pitches (root, third, fifth, upper root), played once. */
  tonic: string[];
  /** The melody notes, in order. */
  melody: MelodyNote[];
}
