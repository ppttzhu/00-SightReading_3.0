import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mocks ────────────────────────────────────────────────────────────────
// Keep the store thin: recordPractice is a spy so grading side-effects don't
// touch the network.
const recordPractice = vi.fn();
vi.mock('../../core/store/useAppStore', () => ({
  useAppStore: () => ({ recordPractice }),
}));

// AudioEngine instantiates a Tone.Sampler at import time, which cannot run in
// jsdom. Replace it with a lightweight fake exposing the surface the screen
// uses, so audio playback can be asserted without the real audio graph.
vi.mock('../../core/engine/AudioEngine', () => {
  const engine = {
    isReady: true,
    enabled: true,
    playNote: vi.fn(() => Promise.resolve()),
    playNotes: vi.fn(() => Promise.resolve()),
    playNotesAdditive: vi.fn(() => Promise.resolve()),
    scheduleNotes: vi.fn(),
    stop: vi.fn(),
    prime: vi.fn(() => Promise.resolve()),
    setEnabled: vi.fn((v: boolean) => { engine.enabled = v; }),
  };
  return { audioEngine: engine };
});

// progressionAudio.playProgression sequences the three blocked chords through
// the engine. Mock it with a spy so we can assert it's invoked with the
// current question's chords (cleaner than reconstructing the schedule from
// playNotes/scheduleNotes calls).
vi.mock('../../core/engine/progressionAudio', () => ({
  playProgression: vi.fn(),
  PROGRESSION_CHORD_GAP_MS: 1000,
}));

// The generator is mocked per-test so we can force specific questions
// deterministically (VexFlow rendering is exercised, but the question content
// is controlled).
vi.mock('../../core/progression/questionGenerator', async () => {
  const actual = await vi.importActual<typeof import('../../core/progression/questionGenerator')>(
    '../../core/progression/questionGenerator',
  );
  return { ...actual, generateQuestion: vi.fn() };
});

import { generateQuestion, type ProgressionQuestion } from '../../core/progression/questionGenerator';
import { audioEngine } from '../../core/engine/AudioEngine';
import { playProgression } from '../../core/engine/progressionAudio';
import { LEVEL6_PROGRESSIONS } from '../../core/progression/progressions';
import ProgressionPractice from './ProgressionPractice';

const mockedGenerate = vi.mocked(generateQuestion);
const mockedPlayProgression = vi.mocked(playProgression);

// Real specs grabbed from LEVEL6_PROGRESSIONS so `specs` is faithful; the
// screen only reads chords / correctAnswer / mode / function for behaviour.
const MAJOR_SUBDOMINANT = LEVEL6_PROGRESSIONS.find(
  (p) => p.mode === 'major' && p.function === 'subdominant',
)!;
const MINOR_DOMINANT = LEVEL6_PROGRESSIONS.find(
  (p) => p.mode === 'minor' && p.function === 'dominant',
)!;

// Q1: C major I – IV – I.
const Q1: ProgressionQuestion = {
  level: 6,
  key: 'C',
  mode: 'major',
  function: 'subdominant',
  specs: MAJOR_SUBDOMINANT.specs,
  // Ascending-bass voicing (Req 15): tonic → subdominant above tonic → upper tonic.
  chords: [
    { pitches: ['C4', 'E4', 'G4'], midis: [60, 64, 67], spelled: ['C', 'E', 'G'] },
    { pitches: ['F4', 'A4', 'C5'], midis: [65, 69, 72], spelled: ['F', 'A', 'C'] },
    { pitches: ['C5', 'E5', 'G5'], midis: [72, 76, 79], spelled: ['C', 'E', 'G'] },
  ],
  progression: 'I – IV – I',
  correctAnswer: 'I – IV – I',
  inversion: 'root',
  presentation: 'blocked',
};

// Q2: A minor i – V – i (used to verify advancing on a correct answer).
const Q2: ProgressionQuestion = {
  level: 6,
  key: 'A',
  mode: 'minor',
  function: 'dominant',
  specs: MINOR_DOMINANT.specs,
  // Ascending-bass voicing (Req 15): tonic → dominant above tonic → upper tonic.
  chords: [
    { pitches: ['A4', 'C5', 'E5'], midis: [69, 72, 76], spelled: ['A', 'C', 'E'] },
    { pitches: ['E5', 'G#5', 'B5'], midis: [76, 80, 83], spelled: ['E', 'G#', 'B'] },
    { pitches: ['A5', 'C6', 'E6'], midis: [81, 84, 88], spelled: ['A', 'C', 'E'] },
  ],
  progression: 'i – V – i',
  correctAnswer: 'i – V – i',
  inversion: 'root',
  presentation: 'blocked',
};

const ANSWER_ORDER = ['I – IV – I', 'I – V – I', 'i – iv – i', 'i – V – i'];

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/client/practice/progression']}>
      <ProgressionPractice />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  recordPractice.mockClear();
  mockedGenerate.mockReset();
  mockedGenerate.mockReturnValue(Q1);
  mockedPlayProgression.mockClear();
  // Audio ready + enabled by default; individual tests override as needed.
  audioEngine.isReady = true;
  audioEngine.enabled = true;
  vi.mocked(audioEngine.stop).mockClear();
  vi.mocked(audioEngine.setEnabled).mockClear();
  vi.mocked(audioEngine.prime).mockClear();
});

afterEach(() => {
  cleanup();
});

describe('ProgressionPractice audio integration', () => {
  // 7.4 — auto-plays exactly once per presentation with the question's chords.
  it('auto-plays the progression once on a new question', async () => {
    renderScreen();

    await waitFor(() => {
      expect(mockedPlayProgression).toHaveBeenCalledTimes(1);
    });
    expect(mockedPlayProgression.mock.calls[0][0]).toEqual(Q1.chords);

    // Effect churn must not replay the same question.
    await new Promise((r) => setTimeout(r, 50));
    expect(mockedPlayProgression).toHaveBeenCalledTimes(1);
  });

  // 8.2, 8.3 — muted → no auto-play.
  it('does not auto-play when audio is disabled', async () => {
    audioEngine.enabled = false;
    renderScreen();

    await new Promise((r) => setTimeout(r, 50));
    expect(mockedPlayProgression).not.toHaveBeenCalled();
  });

  // 8.1 — the replay control plays the current progression again.
  it('replays the current progression on the 播放进行 control', async () => {
    renderScreen();

    // Let the auto-play settle, then isolate the replay call.
    await waitFor(() => {
      expect(mockedPlayProgression).toHaveBeenCalledTimes(1);
    });
    mockedPlayProgression.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /播放和声进行/ }));

    expect(mockedPlayProgression).toHaveBeenCalledTimes(1);
    expect(mockedPlayProgression.mock.calls[0][0]).toEqual(Q1.chords);
  });
});

describe('ProgressionPractice options', () => {
  // 9.1 — exactly four Answer_Choices rendered in fixed order.
  it('renders exactly the four Answer_Choices in fixed order', () => {
    const { container } = renderScreen();

    const optionsRoot = container.querySelector('.quiz-options') as HTMLElement;
    expect(optionsRoot).toBeTruthy();

    const optionButtons = within(optionsRoot).getAllByRole('button');
    expect(optionButtons.map((b) => b.textContent)).toEqual(ANSWER_ORDER);
  });
});

describe('ProgressionPractice grading', () => {
  // 9.2, 9.5, 10.1–10.5 — a correct answer records and advances.
  it('records a correct answer and advances to a new question', async () => {
    mockedGenerate.mockReturnValueOnce(Q1).mockReturnValue(Q2);
    renderScreen();

    const callsBefore = mockedGenerate.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'I – IV – I' }));

    expect(recordPractice).toHaveBeenCalledTimes(1);
    expect(recordPractice.mock.calls[0][0]).toMatchObject({
      quizId: 'prac_progression_major_subdominant',
      module: 'patterns',
      isCorrect: true,
    });

    // nextQuestion regenerates after the correct-feedback delay.
    await waitFor(() => {
      expect(mockedGenerate.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  // 9.3, 9.4, 10.x — a wrong answer records, keeps the question, and ignores
  // further clicks while feedback is showing.
  it('records a wrong answer, retains the question, and ignores further clicks', async () => {
    mockedGenerate.mockReturnValue(Q1);
    renderScreen();

    const callsBefore = mockedGenerate.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'i – V – i' }));

    expect(recordPractice).toHaveBeenCalledTimes(1);
    expect(recordPractice.mock.calls[0][0]).toMatchObject({
      quizId: 'prac_progression_major_subdominant',
      module: 'patterns',
      isCorrect: false,
      answeredWrong: 'i – V – i',
    });

    // A second click while feedback is showing does not record again.
    fireEvent.click(screen.getByRole('button', { name: 'I – V – I' }));
    expect(recordPractice).toHaveBeenCalledTimes(1);

    // The question is retained — no regeneration triggered by a wrong answer.
    await new Promise((r) => setTimeout(r, 50));
    expect(mockedGenerate.mock.calls.length).toBe(callsBefore);
    expect(screen.getByRole('button', { name: 'I – IV – I' })).toBeTruthy();
  });
});
