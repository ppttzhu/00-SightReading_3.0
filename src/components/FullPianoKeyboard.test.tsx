import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  default as FullPianoKeyboard,
  PIANO_ZONES,
  TOTAL_W,
  getKeyCenterX,
  getViewportFrame,
  getZoneCenterX,
  getZoneScrollLeft,
} from './FullPianoKeyboard';

vi.mock('../core/engine/AudioEngine', () => ({
  audioEngine: {
    enabled: false,
    playNote: vi.fn(),
    prime: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('FullPianoKeyboard thumbnail CSS', () => {
  it('scopes zone hover styling to fine-pointer devices', () => {
    const css = readFileSync(`${process.cwd()}/src/index.css`, 'utf8');

    expect(css).toContain('@media (hover: hover) and (pointer: fine)');
    expect(css).not.toContain('.full-piano-keyboard__zone:hover,\n.full-piano-keyboard__zone:focus-visible,\n.full-piano-keyboard__zone--selected');
  });
});

describe('piano zone geometry', () => {
  it('defines seven range-labeled zones covering the approved ranges', () => {
    expect(PIANO_ZONES.map((zone) => zone.label)).toEqual([
      'A0-B1',
      'C2-B2',
      'C3-B3',
      'C4-B4',
      'C5-B5',
      'C6-B6',
      'C7-C8',
    ]);
  });

  it('computes zone centers from key positions', () => {
    expect(getZoneCenterX(PIANO_ZONES[3])).toBe(
      (getKeyCenterX('C4') + getKeyCenterX('B4')) / 2,
    );
  });

  it('clamps scroll targets to the keyboard bounds', () => {
    expect(getZoneScrollLeft(PIANO_ZONES[0], 600)).toBe(0);
    expect(getZoneScrollLeft(PIANO_ZONES[5], 600)).toBeLessThanOrEqual(TOTAL_W - 600);
  });

  it('maps scroll position to thumbnail viewport percentages', () => {
    expect(getViewportFrame(0, 600)).toEqual({
      leftPct: 0,
      widthPct: (600 / TOTAL_W) * 100,
    });
    expect(getViewportFrame(999999, 600).leftPct).toBeLessThanOrEqual(100);
  });
});

describe('FullPianoKeyboard thumbnail', () => {
  it('renders seven range-labeled zone buttons', () => {
    render(<FullPianoKeyboard feedback="none" onAnswer={() => {}} />);

    for (const zone of PIANO_ZONES) {
      expect(screen.getByRole('button', { name: zone.label })).toBeTruthy();
    }
  });

  it('scrolls to a zone without answering', () => {
    const onAnswer = vi.fn();
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      value: 600,
    });
    HTMLElement.prototype.scrollTo = scrollTo;

    render(<FullPianoKeyboard feedback="none" onAnswer={onAnswer} />);
    fireEvent.click(screen.getByRole('button', { name: 'C4-B4' }));

    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('updates the viewport frame when the full keyboard scrolls', () => {
    const { container } = render(<FullPianoKeyboard feedback="none" onAnswer={() => {}} />);
    const scrollArea = container.querySelector('[data-testid="full-piano-scroll"]') as HTMLDivElement;
    const frame = container.querySelector('[data-testid="piano-thumbnail-viewport"]') as HTMLDivElement;

    Object.defineProperty(scrollArea, 'clientWidth', {
      configurable: true,
      value: 600,
    });
    scrollArea.scrollLeft = 400;
    fireEvent.scroll(scrollArea);

    expect(frame.style.left).toBe(`${getViewportFrame(400, 600).leftPct}%`);
    expect(frame.className).toContain('full-piano-keyboard__viewport--visible');
  });

  it('shows a subtle viewport highlight before the full keyboard scrolls', () => {
    const { container } = render(<FullPianoKeyboard feedback="none" onAnswer={() => {}} />);
    const frame = container.querySelector('[data-testid="piano-thumbnail-viewport"]') as HTMLDivElement;

    expect(frame.className).toContain('full-piano-keyboard__viewport--subtle');
    expect(frame.className).not.toContain('full-piano-keyboard__viewport--visible');
  });

  it('only shows the selected zone frame after choosing a zone', () => {
    render(<FullPianoKeyboard feedback="none" onAnswer={() => {}} />);
    const c4Zone = screen.getByRole('button', { name: 'C4-B4' });
    const c5Zone = screen.getByRole('button', { name: 'C5-B5' });

    expect(c4Zone.className).not.toContain('full-piano-keyboard__zone--selected');

    fireEvent.click(c4Zone);

    expect(c4Zone.className).toContain('full-piano-keyboard__zone--selected');
    expect(c5Zone.className).not.toContain('full-piano-keyboard__zone--selected');
  });

  it('clears the selected zone frame when the full keyboard scrolls', () => {
    const { container } = render(<FullPianoKeyboard feedback="none" onAnswer={() => {}} />);
    const scrollArea = container.querySelector('[data-testid="full-piano-scroll"]') as HTMLDivElement;
    const c7Zone = screen.getByRole('button', { name: 'C7-C8' });

    fireEvent.click(c7Zone);
    expect(c7Zone.className).toContain('full-piano-keyboard__zone--selected');

    scrollArea.scrollLeft = 1200;
    fireEvent.scroll(scrollArea);

    expect(c7Zone.className).not.toContain('full-piano-keyboard__zone--selected');
  });
});
