/**
 * The learner's Playback practice configuration: which keys to practice and
 * which mode (bank vs random). Pure and framework-free.
 */

import { PLAYBACK_KEYS, type PlaybackKey } from './playbackTypes';

/** Source of questions: the fixed 22-question bank, or the random generator. */
export type PlaybackMode = 'bank' | 'random';

/** The learner's selected keys: a set of PlaybackKeys. */
export type SelectedKeys = ReadonlySet<PlaybackKey>;

/** Default: all four keys selected. */
export const DEFAULT_KEYS: SelectedKeys = new Set(PLAYBACK_KEYS);

/** Default mode: the question bank. */
export const DEFAULT_MODE: PlaybackMode = 'bank';

/** Toggle one key on/off; never mutates the input. */
export function toggleKey(selection: SelectedKeys, key: PlaybackKey, checked: boolean): SelectedKeys {
  const next = new Set(selection);
  if (checked) next.add(key);
  else next.delete(key);
  return next;
}

/** Start guard: true iff at least one key is selected. */
export function isNonEmpty(selection: SelectedKeys): boolean {
  return selection.size > 0;
}
