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

// The generator is mocked per-test so we can force specific questions and the
// {ok:false} branch deterministically (VexFlow rendering is exercised, but the
// question content is controlled).
vi.mock('../../core/chords/chordGenerator', async () => {
  const actual = await vi.importActual<typeof import('../../core/chords/chordGenerator')>(
    '../../core/chords/chordGenerator',
  );
  return { ...actual, generateQuestion: vi.fn() };
});

import { generateQuestion } from '../../core/chords/chordGenerator';
import { audioEngine } from '../../core/engine/AudioEngine';
import { CATALOG_BY_ID } from '../../core/chords/chordCatalog';
import type { ChordQuestion } from '../../core/chords/chordGenerator';
import ChordPractice from './ChordPractice';

const mockedGenerate = vi.mocked(generateQuestion);

function makeQuestion(id: string, pitches: string[], midis: number[]): ChordQuestion {
  const chordType = CATALOG_BY_ID.get(id)!;
  return {
    chordType,
    pitches,
    midis,
    example: pitches.map((p) => p.replace(/\d+$/, '')),
    correctAnswer: chordType,
  };
}

const MAJ_C = makeQuestion('maj', ['C4', 'E4', 'G4'], [60, 64, 67]);
const MIN_A = makeQuestion('min', ['A3', 'C4', 'E4'], [57, 60, 64]);

function renderAt(scope: string) {
  return render(
    <MemoryRouter initialEntries={[`/client/practice/chords?scope=${scope}`]}>
      <ChordPractice />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  recordPractice.mockClear();
  mockedGenerate.mockReset();
  // Audio ready + enabled by default; individual tests override as needed.
  audioEngine.isReady = true;
  audioEngine.enabled = true;
  vi.mocked(audioEngine.playNotes).mockClear();
  vi.mocked(audioEngine.stop).mockClear();
});

afterEach(() => {
  cleanup();
});

describe('ChordPractice component', () => {
  // 10.1 — decoded scope is reflected in the multiple-choice options.
  it('decodes the scope and reflects it in the options', () => {
    mockedGenerate.mockReturnValue({ ok: true, question: MAJ_C });
    renderAt('maj,min');

    // Only the two enabled types should appear as options.
    expect(screen.getByRole('button', { name: 'Maj' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'min' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Dim7' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Aug' })).toBeNull();
  });

  // 10.4 — a single stacked notation container is rendered.
  it('renders a single stacked notation container', () => {
    mockedGenerate.mockReturnValue({ ok: true, question: MAJ_C });
    const { container } = renderAt('maj,min,aug');

    const notation = screen.getByTestId('chord-notation');
    expect(notation).toBeTruthy();
    // Exactly one notation host — the stacked chord renders into one container.
    expect(container.querySelectorAll('[data-testid="chord-notation"]').length).toBe(1);
  });

  // 10.5 — a correct answer advances to a new question.
  it('advances to a new question on a correct answer', async () => {
    mockedGenerate
      .mockReturnValueOnce({ ok: true, question: MAJ_C })
      .mockReturnValue({ ok: true, question: MIN_A });
    renderAt('maj,min');

    const callsBefore = mockedGenerate.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Maj' }));

    expect(recordPractice).toHaveBeenCalledTimes(1);
    expect(recordPractice.mock.calls[0][0]).toMatchObject({
      quizId: 'prac_chord_maj',
      module: 'patterns',
      isCorrect: true,
    });

    // nextQuestion regenerates after the feedback delay.
    await waitFor(() => {
      expect(mockedGenerate.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  // 10.6 — a wrong answer records but keeps the current question.
  it('retains the current question on a wrong answer', async () => {
    mockedGenerate.mockReturnValue({ ok: true, question: MAJ_C });
    renderAt('maj,min');

    const callsBefore = mockedGenerate.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'min' }));

    expect(recordPractice).toHaveBeenCalledTimes(1);
    expect(recordPractice.mock.calls[0][0]).toMatchObject({
      quizId: 'prac_chord_maj',
      module: 'patterns',
      isCorrect: false,
      answeredWrong: 'min',
    });

    // The question is retained — no regeneration triggered by a wrong answer.
    await new Promise((r) => setTimeout(r, 50));
    expect(mockedGenerate.mock.calls.length).toBe(callsBefore);
    expect(screen.getByRole('button', { name: 'Maj' })).toBeTruthy();
  });

  // 10.7 — {ok:false} shows a reason-keyed message and a 返回选择 button.
  it('shows an explanatory message and 返回选择 on {ok:false}', () => {
    mockedGenerate.mockReturnValue({ ok: false, reason: 'no-placeable-chord' });
    renderAt('maj');

    expect(screen.getByText('所选和弦无法在谱面上生成，请返回调整选择。')).toBeTruthy();
    expect(screen.getByRole('button', { name: '返回选择' })).toBeTruthy();
  });

  it('shows the empty-selection message keyed by reason', () => {
    mockedGenerate.mockReturnValue({ ok: false, reason: 'empty-selection' });
    renderAt('maj');

    expect(screen.getByText('当前没有可练习的和弦，请返回重新选择和弦类型。')).toBeTruthy();
    expect(screen.getByRole('button', { name: '返回选择' })).toBeTruthy();
  });
});

describe('ChordPractice audio integration', () => {
  // 10.2, 10.3 — the chord is played exactly once per presentation with the
  // question's pitches (blocked chord).
  it('plays the chord exactly once per presentation with question.pitches', async () => {
    mockedGenerate.mockReturnValue({ ok: true, question: MAJ_C });
    renderAt('maj,min');

    await waitFor(() => {
      expect(audioEngine.playNotes).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(audioEngine.playNotes).mock.calls[0][0]).toEqual(MAJ_C.pitches);

    // Re-render / effect churn must not replay the same question.
    await new Promise((r) => setTimeout(r, 50));
    expect(audioEngine.playNotes).toHaveBeenCalledTimes(1);
  });

  it('does not play when audio is disabled', async () => {
    audioEngine.enabled = false;
    mockedGenerate.mockReturnValue({ ok: true, question: MAJ_C });
    renderAt('maj,min');

    await new Promise((r) => setTimeout(r, 50));
    expect(audioEngine.playNotes).not.toHaveBeenCalled();
  });
});

describe('ChordPractice speakers-only mode (default, no score)', () => {
  it('shows two speakers and plays a blocked chord from the left speaker', () => {
    mockedGenerate.mockReturnValue({ ok: true, question: MAJ_C });
    renderAt('maj,min'); // no score param → speakers-only

    const speakers = screen.getByTestId('chord-speakers');
    const btns = within(speakers).getAllByRole('button');
    expect(btns.length).toBe(2);

    vi.mocked(audioEngine.playNotes).mockClear();
    fireEvent.click(btns[0]); // left = 柱式 / harmonic
    expect(audioEngine.playNotes).toHaveBeenCalledWith(MAJ_C.pitches);
  });

  it('plays an arpeggiated chord from the right speaker', () => {
    mockedGenerate.mockReturnValue({ ok: true, question: MAJ_C });
    renderAt('maj,min');

    const speakers = screen.getByTestId('chord-speakers');
    const btns = within(speakers).getAllByRole('button');
    fireEvent.click(btns[1]); // right = 分解 / melodic → sequential playback
    expect(audioEngine.playNote).toHaveBeenCalled();
  });

  it('reveals the score briefly on a correct answer', async () => {
    mockedGenerate
      .mockReturnValueOnce({ ok: true, question: MAJ_C })
      .mockReturnValue({ ok: true, question: MIN_A });
    renderAt('maj,min');

    // Speakers shown before answering.
    expect(screen.getByTestId('chord-speakers')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Maj' }));

    // The score container is revealed (speakers hidden) right after a correct answer.
    await waitFor(() => {
      expect(screen.queryByTestId('chord-speakers')).toBeNull();
    });
    expect(screen.getByTestId('chord-notation')).toBeTruthy();
  });
});

describe('ChordPractice score mode (score=1)', () => {
  it('auto-plays the blocked chord once on presentation', async () => {
    mockedGenerate.mockReturnValue({ ok: true, question: MAJ_C });
    renderAt('maj,min&score=1');

    await waitFor(() => {
      expect(audioEngine.playNotes).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(audioEngine.playNotes).mock.calls[0][0]).toEqual(MAJ_C.pitches);
    // No speakers in score mode.
    expect(screen.queryByTestId('chord-speakers')).toBeNull();
  });
});
