import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ── Mocks ────────────────────────────────────────────────────────────────
// Capture navigation without a real router history. useParams / MemoryRouter
// remain real so the route param (moduleId) drives which branch renders.
const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

// Selector-aware store fake (StageSelector reads getAllStages/customStages/slicesPool).
const STAGES = [
  { id: 's1', title: '音型1' },
  { id: 's2', title: '音型2' },
];
const fakeState = {
  getAllStages: () => STAGES,
  customStages: [] as unknown[],
  slicesPool: [] as unknown[],
};
vi.mock('../../core/store/useAppStore', () => ({
  useAppStore: (selector?: (s: typeof fakeState) => unknown) =>
    typeof selector === 'function' ? selector(fakeState) : fakeState,
}));

import StageSelector from './StageSelector';

function renderAt(moduleId: string) {
  return render(
    <MemoryRouter initialEntries={[`/client/free/${moduleId}`]}>
      <Routes>
        <Route path="/client/free/:moduleId" element={<StageSelector />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  navigate.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('StageSelector — patterns progression scope selector', () => {
  // Req 11.1, 11.3 — the patterns branch surfaces the progression exercise with
  // its scope selector (the four progression toggles + a start button).
  it('renders the progression scope selector in the patterns branch', () => {
    renderAt('patterns');
    // The four progression toggles (Roman numerals only).
    expect(screen.getByRole('button', { name: 'I – IV – I' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'I – V – I' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'i – iv – i' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'i – V – i' })).toBeTruthy();
    // The show-score checkbox and start button.
    expect(screen.getByText('显示乐谱')).toBeTruthy();
    expect(screen.getByRole('button', { name: /开始练习/ })).toBeTruthy();
  });

  // Req 11.4 — starting navigates to the dedicated screen carrying the scope
  // (all four progressions selected by default).
  it('navigates to /client/practice/progression with the scope on start', () => {
    renderAt('patterns');
    fireEvent.click(screen.getByRole('button', { name: /开始练习/ }));
    expect(navigate).toHaveBeenCalledTimes(1);
    const target = navigate.mock.calls[0][0] as string;
    expect(target).toContain('/client/practice/progression?scope=');
    // Default selection is all four progressions.
    expect(target).toContain('maj_sub');
    expect(target).toContain('maj_dom');
    expect(target).toContain('min_sub');
    expect(target).toContain('min_dom');
  });

  // Deselecting a progression narrows the scope carried in the URL.
  it('carries only the selected progressions in the scope', () => {
    renderAt('patterns');
    // Turn off the two minor progressions.
    fireEvent.click(screen.getByRole('button', { name: 'i – iv – i' }));
    fireEvent.click(screen.getByRole('button', { name: 'i – V – i' }));
    fireEvent.click(screen.getByRole('button', { name: /开始练习/ }));
    const target = navigate.mock.calls[0][0] as string;
    expect(target).toContain('maj_sub');
    expect(target).toContain('maj_dom');
    expect(target).not.toContain('min_sub');
    expect(target).not.toContain('min_dom');
  });

  // The show-score checkbox adds score=1 to the URL.
  it('adds score=1 when 显示乐谱 is checked', () => {
    renderAt('patterns');
    fireEvent.click(screen.getByLabelText('显示乐谱'));
    fireEvent.click(screen.getByRole('button', { name: /开始练习/ }));
    const target = navigate.mock.calls[0][0] as string;
    expect(target).toContain('score=1');
  });

  // The database-authored 音型 stages grid is hidden on the patterns page — it
  // now serves the progression exercise only.
  it('hides the database-authored 音型 stages grid on the patterns page', () => {
    renderAt('patterns');
    expect(screen.queryByText('音型1')).toBeNull();
    expect(screen.queryByText('音型2')).toBeNull();
  });

  // The progression selector is specific to patterns and does not appear for
  // other stage-grid modules (e.g. symbols).
  it('does not render the progression selector for a non-patterns module', () => {
    renderAt('symbols');
    expect(screen.getByText('音型1')).toBeTruthy();
  });
});
