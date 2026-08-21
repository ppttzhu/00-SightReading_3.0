import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

const fakeState = {
  getAllStages: () => [] as unknown[],
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

beforeEach(() => navigate.mockClear());
afterEach(() => cleanup());

describe('StageSelector — playback setup', () => {
  it('renders the four key toggles, mode toggle, and start button', () => {
    renderAt('playback');
    expect(screen.getByRole('button', { name: 'G Major' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'E Major' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'G minor' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'E minor' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '题库' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '随机出题' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /开始练习/ })).toBeTruthy();
  });

  it('starts with all keys and bank mode by default', () => {
    renderAt('playback');
    fireEvent.click(screen.getByRole('button', { name: /开始练习/ }));
    const target = navigate.mock.calls[0][0] as string;
    expect(target).toContain('/client/practice/playback?keys=');
    expect(target).toContain('gM');
    expect(target).toContain('eM');
    expect(target).toContain('gm');
    expect(target).toContain('em');
    expect(target).toContain('mode=bank');
  });

  it('carries the selected keys and random mode', () => {
    renderAt('playback');
    // Deselect the two minor keys, switch to random.
    fireEvent.click(screen.getByRole('button', { name: 'G minor' }));
    fireEvent.click(screen.getByRole('button', { name: 'E minor' }));
    fireEvent.click(screen.getByRole('button', { name: '随机出题' }));
    fireEvent.click(screen.getByRole('button', { name: /开始练习/ }));
    const target = navigate.mock.calls[0][0] as string;
    expect(target).toContain('gM');
    expect(target).toContain('eM');
    expect(target).not.toContain('gm');
    expect(target).not.toContain('em');
    expect(target).toContain('mode=random');
  });
});
