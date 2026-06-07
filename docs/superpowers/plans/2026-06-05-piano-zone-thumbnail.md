# 钢琴七区缩略导航实现计划

> **给 agentic workers：** 必须使用子技能：优先使用 `superpowers:subagent-driven-development`，或使用 `superpowers:executing-plans` 按任务逐步实现。步骤使用 checkbox（`- [ ]`）语法便于追踪。

**目标：** 在现有 88 键钢琴上方增加一个带 7 个 range label 音区的缩略导航条。

**架构：** 功能保持在 `FullPianoKeyboard` 内：导出少量几何计算 helper 便于测试；在现有滚动容器上方渲染缩略键盘；触屏滑动、桌面拖拽、琴键点击仍然使用原来的大键盘滚动容器。缩略图不提交答案，只负责立即设置大键盘的 `scrollLeft` 并同步当前视窗。默认状态显示 range label、轻量中性分区边界和低调当前视窗高亮；用户手动滑动时增强当前视窗高亮并清除蓝色选区框；点击分区时短暂显示蓝色选区框。hover/focus 的蓝色样式只在 fine pointer 设备启用。

**技术栈：** React 19、TypeScript、Vitest、Testing Library、SVG/CSS。

---

### 任务 1：音区几何模型

**文件：**
- 修改：`src/components/FullPianoKeyboard.tsx`
- 新增：`src/components/FullPianoKeyboard.test.tsx`

- [ ] **步骤 1：先写失败的几何测试**

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
    expect(getViewportFrame(0, 600)).toEqual({ leftPct: 0, widthPct: (600 / TOTAL_W) * 100 });
    expect(getViewportFrame(999999, 600).leftPct).toBeLessThanOrEqual(100);
  });
});
```

- [ ] **步骤 2：运行测试确认红灯**

运行：`npm test -- FullPianoKeyboard`

预期：失败，因为 `FullPianoKeyboard.test.tsx` 或被测试的导出 helper 还不存在。

- [ ] **步骤 3：添加最小几何导出**

在 `src/components/FullPianoKeyboard.tsx` 中导出 `PIANO_ZONES`、`TOTAL_W`、`getKeyCenterX`、`getZoneCenterX`、`getZoneScrollLeft` 和 `getViewportFrame`。保持现有键盘渲染行为不变。

- [ ] **步骤 4：运行测试确认绿灯**

运行：`npm test -- FullPianoKeyboard`

预期：几何测试通过。

### 任务 2：缩略图渲染

**文件：**
- 修改：`src/components/FullPianoKeyboard.tsx`
- 修改：`src/components/FullPianoKeyboard.test.tsx`

- [ ] **步骤 1：先写失败的渲染测试**

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FullPianoKeyboard, { PIANO_ZONES } from './FullPianoKeyboard';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('FullPianoKeyboard thumbnail', () => {
  it('renders seven range-labeled zone buttons', () => {
    render(<FullPianoKeyboard feedback="none" onAnswer={() => {}} />);
    for (const zone of PIANO_ZONES) {
      expect(screen.getByRole('button', { name: zone.label })).toBeTruthy();
    }
  });
});
```

- [ ] **步骤 2：运行测试确认红灯**

运行：`npm test -- FullPianoKeyboard`

预期：失败，因为还没有渲染缩略图音区按钮。

- [ ] **步骤 3：渲染缩略图 UI**

渲染 `.full-piano-keyboard` 外层、位于滚动容器上方的 `.full-piano-keyboard__thumbnail` 缩略键盘、7 个带 range label 的 `button` overlay，以及表示当前视窗的 `.full-piano-keyboard__viewport`。下面的大键盘 SVG 保持原样。

- [ ] **步骤 4：运行测试确认绿灯**

运行：`npm test -- FullPianoKeyboard`

预期：测试通过。

### 任务 3：音区点击导航

**文件：**
- 修改：`src/components/FullPianoKeyboard.tsx`
- 修改：`src/components/FullPianoKeyboard.test.tsx`

- [ ] **步骤 1：先写失败的行为测试**

```tsx
describe('FullPianoKeyboard thumbnail navigation', () => {
  it('jumps to a zone immediately without answering', () => {
    const onAnswer = vi.fn();
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 600 });
    HTMLElement.prototype.scrollTo = scrollTo;

    render(<FullPianoKeyboard feedback="none" onAnswer={onAnswer} />);
    fireEvent.click(screen.getByRole('button', { name: 'C4-B4' }));

    expect(scrollTo).not.toHaveBeenCalled();
    expect(onAnswer).not.toHaveBeenCalled();
  });
});
```

- [ ] **步骤 2：运行测试确认红灯**

运行：`npm test -- FullPianoKeyboard`

预期：失败，因为点击音区还不会滚动。

- [ ] **步骤 3：实现音区点击导航**

添加 `handleZoneClick(zone)`：用 `getZoneScrollLeft(zone, container.clientWidth)` 计算目标位置，直接设置 `container.scrollLeft = left`，并立即同步缩略图当前视窗。程序跳转产生的第一下 scroll event 不清除点击选区；用户后续手动滑动仍会清除选区。

- [ ] **步骤 4：运行测试确认绿灯**

运行：`npm test -- FullPianoKeyboard`

预期：测试通过。

### 任务 4：视窗同步和视觉 polish

**文件：**
- 修改：`src/components/FullPianoKeyboard.tsx`
- 修改：`src/index.css`
- 修改：`src/components/FullPianoKeyboard.test.tsx`

- [ ] **步骤 1：先写失败的视窗同步测试**

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

- [ ] **步骤 2：运行测试确认红灯**

运行：`npm test -- FullPianoKeyboard`

预期：失败，直到 scroll 事件真正驱动视窗状态更新。

- [ ] **步骤 3：实现 scroll state 和样式**

在 React state 中保存 `scrollLeft` 和 `clientWidth` 计算出的视窗 frame。组件挂载、居中 C4 后、以及每次 scroll 时都更新它。为外层、缩略图、音区按钮、小键盘、视窗高亮和滑动时的不透明度添加 CSS class。视窗高亮默认低调显示，scroll active 时增强；分区按钮默认显示轻量中性边界，hover/focus 或点击选中后显示更强的蓝色边框。

- [ ] **步骤 4：运行测试确认绿灯**

运行：`npm test -- FullPianoKeyboard`

预期：测试通过。

### 任务 5：OpenSpec checklist 和验证

**文件：**
- 修改：`openspec/changes/add-piano-zone-thumbnail/tasks.md`

- [ ] **步骤 1：标记 OpenSpec 任务完成**

只有在实现和验证都完成之后，才把 `openspec/changes/add-piano-zone-thumbnail/tasks.md` 里的所有任务从 `- [ ]` 更新为 `- [x]`。

- [ ] **步骤 2：运行 focused test**

运行：`npm test -- FullPianoKeyboard`

预期：通过。

- [ ] **步骤 3：运行完整测试**

运行：`npm test`

预期：通过。

- [ ] **步骤 4：运行 build**

运行：`npm run build`

预期：通过。

- [ ] **步骤 5：运行 OpenSpec validation**

运行：`openspec validate add-piano-zone-thumbnail --strict`

预期：`Change 'add-piano-zone-thumbnail' is valid`。
