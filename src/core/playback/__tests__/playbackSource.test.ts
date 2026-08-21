import { describe, it, expect } from 'vitest';
import { nextQuestion } from '../playbackSource';
import { PLAYBACK_BANK } from '../playbackBank';
import { PLAYBACK_KEYS } from '../playbackTypes';

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('nextQuestion — bank mode', () => {
  it('only returns bank questions in the selected keys', () => {
    const rng = makeRng(1);
    for (let i = 0; i < 100; i++) {
      const q = nextQuestion('bank', ['G minor'], rng);
      expect(q.key).toBe('G minor');
      expect(PLAYBACK_BANK.some((b) => b.id === q.id)).toBe(true);
    }
  });

  it('falls back to the full bank when the key filter matches nothing', () => {
    // (No key is unsupported here, but an empty selection uses all keys.)
    const q = nextQuestion('bank', [], makeRng(2));
    expect(PLAYBACK_BANK.some((b) => b.id === q.id)).toBe(true);
  });
});

describe('nextQuestion — random mode', () => {
  it('generates a question in the selected keys', () => {
    const rng = makeRng(3);
    for (let i = 0; i < 50; i++) {
      const q = nextQuestion('random', ['E major'], rng);
      expect(q.key).toBe('E major');
    }
  });
});

describe('question bank integrity', () => {
  it('has 22 questions, all in supported keys with a 4-note tonic and a non-empty melody', () => {
    expect(PLAYBACK_BANK).toHaveLength(22);
    for (const q of PLAYBACK_BANK) {
      expect(PLAYBACK_KEYS).toContain(q.key);
      expect(q.tonic).toHaveLength(4);
      expect(q.melody.length).toBeGreaterThan(0);
    }
  });
});
