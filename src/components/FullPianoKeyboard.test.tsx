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

describe('piano zone geometry', () => {
  it('defines six range-labeled zones covering the approved ranges', () => {
    expect(PIANO_ZONES.map((zone) => zone.label)).toEqual([
      'A0-B1',
      'C2-B2',
      'C3-B3',
      'C4-B4',
      'C5-B5',
      'C6-C8',
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
  it('renders six range-labeled zone buttons', () => {
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
  });
});
