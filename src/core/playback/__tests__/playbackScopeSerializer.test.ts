import { describe, it, expect } from 'vitest';
import { encodeKeys, decodeKeys, decodeMode } from '../playbackScopeSerializer';
import { DEFAULT_KEYS } from '../playbackSelection';
import type { PlaybackKey } from '../playbackTypes';

function params(s: string): URLSearchParams {
  return new URLSearchParams(s);
}

describe('encodeKeys / decodeKeys', () => {
  it('round-trips a selection in canonical order', () => {
    const sel = new Set<PlaybackKey>(['E minor', 'G major']);
    expect(encodeKeys(sel)).toBe('gM,em'); // canonical order: gM, eM, gm, em
    const decoded = decodeKeys(params(`keys=${encodeKeys(sel)}`));
    expect([...decoded].sort()).toEqual(['E minor', 'G major']);
  });

  it('falls back to all keys when absent, empty, or all-invalid', () => {
    expect(decodeKeys(params(''))).toEqual(DEFAULT_KEYS);
    expect(decodeKeys(params('keys='))).toEqual(DEFAULT_KEYS);
    expect(decodeKeys(params('keys=zzz,qqq'))).toEqual(DEFAULT_KEYS);
  });

  it('drops unknown tokens and collapses duplicates', () => {
    const decoded = decodeKeys(params('keys=gM,gM,zzz,em'));
    expect([...decoded].sort()).toEqual(['E minor', 'G major']);
  });
});

describe('decodeMode', () => {
  it('reads bank/random and falls back to bank', () => {
    expect(decodeMode(params('mode=random'))).toBe('random');
    expect(decodeMode(params('mode=bank'))).toBe('bank');
    expect(decodeMode(params(''))).toBe('bank');
    expect(decodeMode(params('mode=nonsense'))).toBe('bank');
  });
});
