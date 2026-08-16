import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ── Mocks ────────────────────────────────────────────────────────────────
// The store is kept thin: StageSelector reads getAllStages/customStages/
// slicesPool via selector calls. A tiny fake state satisfies every selector
// without touching the network or the real Zustand store.
const fakeState = {
  getAllStages: () => [],
  customStages: [],
  slicesPool: [],
};
vi.mock('../../core/store/useAppStore', () => ({
  useAppStore: (selector?: (s: typeof fakeState) => unknown) =>
    selector ? selector(fakeState) : fakeState,
}));

// Capture navigation without a real router history.
const navigateSpy = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateSpy };
});

import StageSelector from './StageSelector';
import { CHORD_CATALOG } from '../../core/chords/chordCatalog';
import { DEFAULT_SELECTION } from '../../core/chords/chordSelection';

// Render StageSelector as the app routes it: /client/free/:moduleId, so
// useParams sees moduleId='patterns'.
function renderPatterns() {
  return render(
    <MemoryRouter initialEntries={['/client/free/patterns']}>
      <Routes>
        <Route path="/client/free/:moduleId" element={<StageSelector />} />
      </Routes>
    </MemoryRouter>,
  );
}

// Query a chord chip by its uiLabel. Chips are buttons carrying aria-pressed.
function chip(label: string): HTMLButtonElement {
  return screen
    .getAllByRole('button', { name: label })
    .find((b) => b.getAttribute('aria-pressed') !== null) as HTMLButtonElement;
}

beforeEach(() => {
  navigateSpy.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('StageSelector patterns/和弦 random-practice branch', () => {
  // 3.1, 3.5 — one chip per catalog entry, labeled by uiLabel.
  it('renders one chord chip per catalog entry labeled by uiLabel', () => {
    renderPatterns();
    for (const entry of CHORD_CATALOG) {
      expect(chip(entry.uiLabel)).toBeTruthy();
    }
    // Seven chord chips (buttons with aria-pressed) in total.
    const chips = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') !== null);
    expect(chips.length).toBe(CHORD_CATALOG.length);
  });

  // 3.2, 4.1 — default selection reflects {maj, min, aug} as pressed.
  it('reflects the default selection {maj, min, aug} as selected', () => {
    renderPatterns();
    for (const entry of CHORD_CATALOG) {
      const expected = DEFAULT_SELECTION.has(entry.id);
      expect(chip(entry.uiLabel).getAttribute('aria-pressed')).toBe(String(expected));
    }
  });

  // 3.3, 3.4 — toggling a chip flips its selected state.
  it('toggles a chip on and off when clicked', () => {
    renderPatterns();
    // Maj7 starts unselected; clicking selects it, clicking again clears it.
    expect(chip('Maj7').getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(chip('Maj7'));
    expect(chip('Maj7').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(chip('Maj7'));
    expect(chip('Maj7').getAttribute('aria-pressed')).toBe('false');
  });

  // 4.2, 4.3 — clearing the selection disables start and shows the hint.
  it('disables start and shows the hint when the selection is empty', () => {
    renderPatterns();
    // Clear the three default chips (Maj, min, Dom7).
    fireEvent.click(chip('Maj'));
    fireEvent.click(chip('min'));
    fireEvent.click(chip('Dom7'));

    expect(screen.getByText('请至少选择一个和弦')).toBeTruthy();
    const start = screen.getByRole('button', { name: /开始练习/ }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
  });

  // 4.4 — a non-empty selection enables start and hides the hint.
  it('enables start when the selection is non-empty', () => {
    renderPatterns();
    expect(screen.queryByText('请至少选择一个和弦')).toBeNull();
    const start = screen.getByRole('button', { name: /开始练习/ }) as HTMLButtonElement;
    expect(start.disabled).toBe(false);
  });

  // 5.1 — start navigates to the practice screen with the encoded scope.
  it('navigates to /client/practice/chords?scope=... on start (default)', () => {
    renderPatterns();
    fireEvent.click(screen.getByRole('button', { name: /开始练习/ }));
    expect(navigateSpy).toHaveBeenCalledWith('/client/practice/chords?scope=maj,min,dom7');
  });

  // 5.1 — the scope reflects the current selection after toggling.
  it('encodes the current selection into the scope on start', () => {
    renderPatterns();
    // From the default {maj, min, dom7}: deselect min and Dom7, add Dim7 →
    // canonical order emits maj,dim7.
    fireEvent.click(chip('min'));
    fireEvent.click(chip('Dom7'));
    fireEvent.click(chip('Dim7'));
    fireEvent.click(screen.getByRole('button', { name: /开始练习/ }));
    expect(navigateSpy).toHaveBeenCalledWith('/client/practice/chords?scope=maj,dim7');
  });
});
