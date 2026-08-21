/**
 * Serialize the Playback key selection + mode to/from the navigation query
 * string. The setup page encodes `?keys=gM,eM,gm,em&mode=bank`; the practice
 * screen decodes it. Decoding is total (never throws) and falls back to
 * sensible defaults. Pure and framework-free.
 */

import type { PlaybackKey } from './playbackTypes';
import {
  DEFAULT_KEYS,
  DEFAULT_MODE,
  type PlaybackMode,
  type SelectedKeys,
} from './playbackSelection';

/** Query param names. */
export const KEYS_PARAM = 'keys';
export const MODE_PARAM = 'mode';

const TOKEN_SEPARATOR = ',';

/** Key ↔ short URL token. */
const KEY_TO_TOKEN: Record<PlaybackKey, string> = {
  'G major': 'gM',
  'E major': 'eM',
  'G minor': 'gm',
  'E minor': 'em',
};
const TOKEN_TO_KEY: Record<string, PlaybackKey> = {
  gM: 'G major',
  eM: 'E major',
  gm: 'G minor',
  em: 'E minor',
};

/** Encode the selected keys into their query token list (canonical order). */
export function encodeKeys(selection: SelectedKeys): string {
  return (Object.keys(KEY_TO_TOKEN) as PlaybackKey[])
    .filter((k) => selection.has(k))
    .map((k) => KEY_TO_TOKEN[k])
    .join(TOKEN_SEPARATOR);
}

/** Decode the `keys` param into a selection; falls back to all keys when absent/invalid. */
export function decodeKeys(params: URLSearchParams): SelectedKeys {
  const raw = params.get(KEYS_PARAM);
  if (raw === null) return DEFAULT_KEYS;
  const keys = new Set<PlaybackKey>();
  for (const token of raw.split(TOKEN_SEPARATOR)) {
    const key = TOKEN_TO_KEY[token.trim()];
    if (key) keys.add(key);
  }
  return keys.size > 0 ? keys : DEFAULT_KEYS;
}

/** Decode the `mode` param; falls back to the bank when absent/invalid. */
export function decodeMode(params: URLSearchParams): PlaybackMode {
  const raw = params.get(MODE_PARAM);
  return raw === 'random' || raw === 'bank' ? raw : DEFAULT_MODE;
}
