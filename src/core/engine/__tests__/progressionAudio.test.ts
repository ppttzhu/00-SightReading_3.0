import { describe, it, expect, vi, beforeEach } from 'vitest';

// The real AudioEngine constructs a Tone.Sampler + touches the audio graph on
// import, which does not work under jsdom. Replace it with a lightweight fake
// exposing only the surface the helper uses, so scheduling can be asserted
// without a real audio graph.
vi.mock('../AudioEngine', () => {
  const engine = {
    playNotes: vi.fn(() => Promise.resolve()),
    scheduleNotes: vi.fn(),
    stop: vi.fn(),
  };
  return { audioEngine: engine };
});

// Mock pitchToToneNote to an identity so assertions read on the resolved
// pitches directly (the transform itself is covered by pitchUtils tests).
vi.mock('../pitchUtils', () => ({
  pitchToToneNote: (pitch: string) => pitch,
}));

import { audioEngine } from '../AudioEngine';
import { playProgression, PROGRESSION_CHORD_GAP_MS } from '../progressionAudio';
import type { ResolvedChord } from '../../progression/chordResolver';

/** Build a fake resolved triad from three octave-tagged pitches. */
function makeChord(pitches: string[]): ResolvedChord {
  return { pitches, midis: [0, 0, 0], spelled: pitches.map((p) => p.slice(0, -1)) };
}

const CHORD_0 = makeChord(['C4', 'E4', 'G4']);
const CHORD_1 = makeChord(['F4', 'A4', 'C5']);
const CHORD_2 = makeChord(['C4', 'E4', 'G4']);

beforeEach(() => {
  vi.mocked(audioEngine.playNotes).mockClear();
  vi.mocked(audioEngine.scheduleNotes).mockClear();
  vi.mocked(audioEngine.stop).mockClear();
});

describe('playProgression', () => {
  it('plays chord 0 immediately as a single blocked chord (all tones at once)', () => {
    playProgression([CHORD_0, CHORD_1, CHORD_2]);

    // A single playNotes call carrying all of chord 0's tones (blocked, not
    // arpeggiated).
    expect(audioEngine.playNotes).toHaveBeenCalledTimes(1);
    expect(vi.mocked(audioEngine.playNotes).mock.calls[0][0]).toEqual(CHORD_0.pitches);
  });

  it('schedules later chords at index * gap with additive === false', () => {
    playProgression([CHORD_0, CHORD_1, CHORD_2]);

    // Chord 0 is not scheduled (it sounds immediately); chords 1 and 2 are.
    expect(audioEngine.scheduleNotes).toHaveBeenCalledTimes(2);

    const calls = vi.mocked(audioEngine.scheduleNotes).mock.calls;

    // Chord 1 at 1 * gap, additive false.
    expect(calls[0]).toEqual([CHORD_1.pitches, PROGRESSION_CHORD_GAP_MS, false]);
    // Chord 2 at 2 * gap, additive false.
    expect(calls[1]).toEqual([CHORD_2.pitches, 2 * PROGRESSION_CHORD_GAP_MS, false]);
  });

  it('schedules the three chords in order at the expected delays', () => {
    playProgression([CHORD_0, CHORD_1, CHORD_2]);

    // Immediate chord first.
    expect(vi.mocked(audioEngine.playNotes).mock.calls[0][0]).toEqual(CHORD_0.pitches);

    // Delays are strictly increasing and match index * gap.
    const delays = vi.mocked(audioEngine.scheduleNotes).mock.calls.map((c) => c[1]);
    expect(delays).toEqual([PROGRESSION_CHORD_GAP_MS, 2 * PROGRESSION_CHORD_GAP_MS]);

    // additive is false for every scheduled (blocked) chord.
    const additiveFlags = vi.mocked(audioEngine.scheduleNotes).mock.calls.map((c) => c[2]);
    expect(additiveFlags).toEqual([false, false]);
  });

  it('returns without playing anything for an empty progression', () => {
    playProgression([]);
    expect(audioEngine.playNotes).not.toHaveBeenCalled();
    expect(audioEngine.scheduleNotes).not.toHaveBeenCalled();
  });
});
