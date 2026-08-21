/**
 * Question source for the Playback exercise: draw the next question either from
 * the fixed 22-question bank (filtered to the selected keys) or from the random
 * generator. Pure and framework-free (rng injectable).
 */

import type { PlaybackKey, PlaybackQuestion } from './playbackTypes';
import { PLAYBACK_KEYS } from './playbackTypes';
import { PLAYBACK_BANK } from './playbackBank';
import { generateQuestion } from './playbackGenerator';
import type { PlaybackMode } from './playbackSelection';

/** Pick one element uniformly. */
function pick<T>(items: readonly T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)];
}

/**
 * Produce the next Playback question for the given mode and selected keys.
 *
 * - `'bank'`: uniformly pick from the bank entries whose key is selected (falls
 *   back to the full bank when the filter is empty).
 * - `'random'`: generate one via {@link generateQuestion} restricted to the
 *   selected keys.
 *
 * @param mode      bank or random
 * @param keys      the selected keys (array)
 * @param rng       random source; defaults to Math.random
 */
export function nextQuestion(
  mode: PlaybackMode,
  keys: readonly PlaybackKey[],
  rng: () => number = Math.random,
): PlaybackQuestion {
  const pool = keys.length > 0 ? keys : PLAYBACK_KEYS;
  if (mode === 'random') {
    return generateQuestion(pool, rng);
  }
  const keySet = new Set(pool);
  const candidates = PLAYBACK_BANK.filter((q) => keySet.has(q.key));
  const bank = candidates.length > 0 ? candidates : PLAYBACK_BANK;
  return pick(bank, rng);
}
