# Piano Zone Thumbnail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a six-zone range-labeled thumbnail navigator above the existing 88-key piano.

**Architecture:** Keep the feature inside `FullPianoKeyboard`: export small geometry helpers for tests, render a thumbnail strip above the existing scroll container, and use the same scroll container for touch/drag/key clicking. The thumbnail never submits answers; it only calls `scrollTo` on the full keyboard.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, SVG/CSS.

---

### Task 1: Zone Geometry

**Files:**
- Modify: `src/components/FullPianoKeyboard.tsx`
- Create: `src/components/FullPianoKeyboard.test.tsx`

- [ ] **Step 1: Write the failing geometry tests**

```tsx
import { describe, expect, it } from 'vitest';
import {
  PIANO_ZONES,
  TOTAL_W,
  getKeyCenterX,
  getZoneCenterX,
  getZoneScrollLeft,
  getViewportFrame,
} from './FullPianoKeyboard';

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
    expect(getViewportFrame(0, 600)).toEqual({ leftPct: 0, widthPct: (600 / TOTAL_W) * 100 });
    expect(getViewportFrame(999999, 600).leftPct).toBeLessThanOrEqual(100);
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run: `npm test -- FullPianoKeyboard`

Expected: FAIL because `FullPianoKeyboard.test.tsx` or the exported helpers do not exist yet.

- [ ] **Step 3: Add minimal geometry exports**

In `src/components/FullPianoKeyboard.tsx`, export `PIANO_ZONES`, `TOTAL_W`, `getKeyCenterX`, `getZoneCenterX`, `getZoneScrollLeft`, and `getViewportFrame`. Keep existing keyboard rendering behavior unchanged.

- [ ] **Step 4: Run test to verify GREEN**

Run: `npm test -- FullPianoKeyboard`

Expected: PASS for geometry tests.

### Task 2: Thumbnail Rendering

**Files:**
- Modify: `src/components/FullPianoKeyboard.tsx`
- Modify: `src/components/FullPianoKeyboard.test.tsx`

- [ ] **Step 1: Write the failing render tests**

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FullPianoKeyboard, { PIANO_ZONES } from './FullPianoKeyboard';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('FullPianoKeyboard thumbnail', () => {
  it('renders six range-labeled zone buttons', () => {
    render(<FullPianoKeyboard feedback="none" onAnswer={() => {}} />);
    for (const zone of PIANO_ZONES) {
      expect(screen.getByRole('button', { name: zone.label })).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run: `npm test -- FullPianoKeyboard`

Expected: FAIL because no thumbnail zone buttons are rendered.

- [ ] **Step 3: Render thumbnail UI**

Render a `.full-piano-keyboard` wrapper, a `.full-piano-keyboard__thumbnail` strip above the scroll container, six `button` overlays labeled with each range, and a `.full-piano-keyboard__viewport` element for the current viewport. Keep the full SVG keyboard unchanged below it.

- [ ] **Step 4: Run test to verify GREEN**

Run: `npm test -- FullPianoKeyboard`

Expected: PASS.

### Task 3: Zone Click Navigation

**Files:**
- Modify: `src/components/FullPianoKeyboard.tsx`
- Modify: `src/components/FullPianoKeyboard.test.tsx`

- [ ] **Step 1: Write failing behavior tests**

```tsx
describe('FullPianoKeyboard thumbnail navigation', () => {
  it('scrolls to a zone without answering', () => {
    const onAnswer = vi.fn();
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 600 });
    HTMLElement.prototype.scrollTo = scrollTo;

    render(<FullPianoKeyboard feedback="none" onAnswer={onAnswer} />);
    fireEvent.click(screen.getByRole('button', { name: 'C4-B4' }));

    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
    expect(onAnswer).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run: `npm test -- FullPianoKeyboard`

Expected: FAIL because zone clicks do not scroll yet.

- [ ] **Step 3: Implement zone click navigation**

Add `handleZoneClick(zone)` to compute `getZoneScrollLeft(zone, container.clientWidth)` and call `container.scrollTo({ left, behavior: 'smooth' })`. If `scrollTo` is unavailable, assign `container.scrollLeft = left`.

- [ ] **Step 4: Run test to verify GREEN**

Run: `npm test -- FullPianoKeyboard`

Expected: PASS.

### Task 4: Viewport Sync And Polish

**Files:**
- Modify: `src/components/FullPianoKeyboard.tsx`
- Modify: `src/index.css`
- Modify: `src/components/FullPianoKeyboard.test.tsx`

- [ ] **Step 1: Write a failing viewport sync test**

```tsx
it('updates the viewport frame when the full keyboard scrolls', () => {
  const { container } = render(<FullPianoKeyboard feedback="none" onAnswer={() => {}} />);
  const scrollArea = container.querySelector('[data-testid="full-piano-scroll"]') as HTMLDivElement;
  const frame = container.querySelector('[data-testid="piano-thumbnail-viewport"]') as HTMLDivElement;

  Object.defineProperty(scrollArea, 'clientWidth', { configurable: true, value: 600 });
  scrollArea.scrollLeft = 400;
  fireEvent.scroll(scrollArea);

  expect(frame.style.left).toBe(`${getViewportFrame(400, 600).leftPct}%`);
});
```

- [ ] **Step 2: Run test to verify RED**

Run: `npm test -- FullPianoKeyboard`

Expected: FAIL until viewport state is connected to scroll events.

- [ ] **Step 3: Implement scroll state and styles**

Store `scrollLeft` and `clientWidth` in React state. Update it on mount, after centering C4, and on every scroll. Add CSS classes for the wrapper, thumbnail, zone buttons, mini keys, viewport frame, and active scrolling opacity.

- [ ] **Step 4: Run test to verify GREEN**

Run: `npm test -- FullPianoKeyboard`

Expected: PASS.

### Task 5: OpenSpec Tasks And Verification

**Files:**
- Modify: `openspec/changes/add-piano-zone-thumbnail/tasks.md`

- [ ] **Step 1: Mark OpenSpec tasks complete**

Update every task in `openspec/changes/add-piano-zone-thumbnail/tasks.md` from `- [ ]` to `- [x]` only after implementation and verification are complete.

- [ ] **Step 2: Run focused test**

Run: `npm test -- FullPianoKeyboard`

Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Run OpenSpec validation**

Run: `openspec validate add-piano-zone-thumbnail --strict`

Expected: `Change 'add-piano-zone-thumbnail' is valid`.
