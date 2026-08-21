import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('../../core/engine/AudioEngine', () => {
  const engine = {
    isReady: true,
    enabled: true,
    playNotes: vi.fn(() => Promise.resolve()),
    scheduleNotes: vi.fn(),
    stop: vi.fn(),
    prime: vi.fn(() => Promise.resolve()),
    setEnabled: vi.fn((v: boolean) => { engine.enabled = v; }),
  };
  return { audioEngine: engine };
});

vi.mock('../../core/engine/playbackAudio', () => ({
  playTonic: vi.fn(),
  playMelody: vi.fn(),
  PLAYBACK_BPM: 90,
  MS_PER_BEAT: 60000 / 90,
}));

// Capture the useMidi onNoteOn callback so tests can simulate MIDI input.
// `midiStatus` lets a test simulate a disconnected keyboard.
let midiOnNoteOn: ((pitch: string) => void) | null = null;
let midiStatus: 'connected' | 'no-device' = 'connected';
vi.mock('../../hooks/useMidi', () => ({
  useMidi: (opts: { enabled: boolean; onNoteOn: (p: string) => void }) => {
    midiOnNoteOn = opts.onNoteOn;
    return { status: midiStatus, deviceName: midiStatus === 'connected' ? 'Test' : null, error: null };
  },
}));

// Force a fixed question (G major, C4-... a simple melody) regardless of scope.
const FIXED = {
  id: 'Weekly_03',
  key: 'G major' as const,
  meter: '4/4' as const,
  tonic: ['G4', 'B4', 'D5', 'G5'],
  melody: [
    { pitch: 'G4', beats: 1 },
    { pitch: 'A4', beats: 1 },
    { pitch: 'B4', beats: 1 },
    { pitch: 'G4', beats: 1 },
    { pitch: 'D5', beats: 2 },
    { pitch: 'G4', beats: 2 },
  ],
};
vi.mock('../../core/playback/playbackSource', () => ({
  nextQuestion: vi.fn(() => FIXED),
}));

import { audioEngine } from '../../core/engine/AudioEngine';
import { playTonic, playMelody } from '../../core/engine/playbackAudio';
import PlaybackPractice from './PlaybackPractice';

function renderAt(qs = 'keys=gM&mode=bank') {
  return render(
    <MemoryRouter initialEntries={[`/client/practice/playback?${qs}`]}>
      <PlaybackPractice />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  midiOnNoteOn = null;
  midiStatus = 'connected';
  audioEngine.enabled = true;
  vi.mocked(playTonic).mockClear();
  vi.mocked(playMelody).mockClear();
});

afterEach(() => cleanup());

describe('PlaybackPractice', () => {
  it('always shows the key and time signature', () => {
    renderAt();
    expect(screen.getByText(/G major/)).toBeTruthy();
    expect(screen.getByText(/4\/4/)).toBeTruthy();
  });

  it('shows the bank question id in bank mode', () => {
    renderAt('keys=gM&mode=bank');
    expect(screen.getByTestId('playback-bank-id').textContent).toContain('Weekly 3');
  });

  it('does not show a bank id in random mode', () => {
    renderAt('keys=gM&mode=random');
    expect(screen.queryByTestId('playback-bank-id')).toBeNull();
  });

  it('has two speakers: tonic chord and melody', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: '播放主和弦' }));
    expect(playTonic).toHaveBeenCalledWith(FIXED.tonic);
    fireEvent.click(screen.getByRole('button', { name: '播放旋律' }));
    expect(playMelody).toHaveBeenCalledWith(FIXED.melody);
  });

  it('toggles the answer sheet', () => {
    renderAt();
    // Hidden by default.
    expect(screen.queryByTestId('playback-notation')).toBeNull();
    expect(screen.getByText('答案已隐藏')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '显示答案' }));
    expect(screen.getByTestId('playback-notation')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '隐藏答案' }));
    expect(screen.queryByTestId('playback-notation')).toBeNull();
  });

  it('auto-listens on a connected MIDI keyboard (no toggle button) and shows live progress', () => {
    renderAt();
    // No MIDI toggle button anymore.
    expect(screen.queryByRole('button', { name: /MIDI/ })).toBeNull();
    expect(midiOnNoteOn).toBeTruthy();
    // Connected keyboard → progress readout is shown, hint is not.
    expect(screen.getByTestId('playback-midi-progress')).toBeTruthy();
    expect(screen.queryByTestId('playback-midi-hint')).toBeNull();
  });

  it('progressively reveals matched notes on the sheet as they are played', () => {
    renderAt();
    // Sheet hidden until the first correct note.
    expect(screen.queryByTestId('playback-notation')).toBeNull();
    act(() => { midiOnNoteOn!('G3'); }); // first note correct (octave-agnostic)
    expect(screen.getByTestId('playback-notation')).toBeTruthy();
    expect(screen.getByText(/已弹对 1 \//)).toBeTruthy();
  });

  it('reveals the full sheet and celebrates when the whole melody is played correctly (octave-agnostic)', () => {
    vi.useFakeTimers();
    renderAt();
    const seq = ['G3', 'A3', 'B3', 'G3', 'D4', 'G3'];
    act(() => { for (const p of seq) midiOnNoteOn!(p); });
    expect(screen.getByTestId('playback-notation')).toBeTruthy();
    expect(screen.getByText('全部弹对！进入下一题…')).toBeTruthy();
    vi.useRealTimers();
  });

  it('auto-advances to the next question ~1s after a fully-correct MIDI answer', () => {
    vi.useFakeTimers();
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: '显示答案' }));
    const seq = ['G3', 'A3', 'B3', 'G3', 'D4', 'G3'];
    act(() => { for (const p of seq) midiOnNoteOn!(p); });
    // Celebration cue visible; advance the timer to trigger nextQuestion, which
    // resets revealed/progress state (sheet hidden again).
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.queryByText('全部弹对！进入下一题…')).toBeNull();
    expect(screen.getByText('答案已隐藏')).toBeTruthy();
    vi.useRealTimers();
  });

  it('resets progress and re-hides the sheet on a wrong MIDI note', () => {
    renderAt();
    act(() => { midiOnNoteOn!('G4'); }); // correct first note reveals one note
    expect(screen.getByTestId('playback-notation')).toBeTruthy();
    act(() => { midiOnNoteOn!('C5'); }); // wrong second note (expected A) → reset
    expect(screen.queryByTestId('playback-notation')).toBeNull();
    expect(screen.getByText('弹错了，请从头再来')).toBeTruthy();
  });

  it('shows a hint (and no progress) when no MIDI keyboard is connected', () => {
    midiStatus = 'no-device';
    renderAt();
    expect(screen.getByTestId('playback-midi-hint')).toBeTruthy();
    expect(screen.queryByTestId('playback-midi-progress')).toBeNull();
  });

  it('advances to a new question and re-hides the sheet on 下一题', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: '显示答案' }));
    expect(screen.getByTestId('playback-notation')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /下一题/ }));
    expect(screen.queryByTestId('playback-notation')).toBeNull();
  });
});
