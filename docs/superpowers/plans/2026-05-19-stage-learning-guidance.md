# Stage Learning Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 闯关模式每关进入前，若关卡有「学习指导」（Markdown 文本），先显示一个全屏蒙层；点「开始答题」进入 quiz。教师端关卡编辑器加 textarea + 实时预览，并允许编辑预设关卡的 guidance（其他字段锁住）。

**Architecture:**
- 数据层：在 `CustomStage` 加可选 `guidance: string` 字段；`generatePresetStages` 按 id 保留旧 preset 的 guidance。
- 渲染层：新建 `GuidanceModal` 组件（react-markdown + remark-gfm）。
- 接入层：`InteractiveQuiz` 早 return 蒙层；`CustomStageEditor` 加 textarea + 实时预览 + preset 编辑路径。
- 抑制层：localStorage 存 `{stageId: guidance 快照}`，老师改了自动重弹。

**Tech Stack:** TypeScript, React 19, zustand, react-markdown ^9, remark-gfm ^4, Vitest

**Spec:** `docs/superpowers/specs/2026-05-18-stage-guidance-design.md`
**OpenSpec change:** `openspec/changes/add-stage-guidance/`
**Issue:** [#14](https://github.com/ppttzhu/00-SightReading_3.0/issues/14)

---

## File Structure

**Create:**
- `src/components/GuidanceModal.tsx` — 全屏蒙层组件
- `src/components/GuidanceModal.test.tsx` — vitest 测试

**Modify:**
- `package.json` — 加 react-markdown、remark-gfm 依赖
- `src/core/store/useAppStore.ts` — `CustomStage.guidance?: string` + `generatePresetStages` 保留逻辑
- `src/pages/client/InteractiveQuiz.tsx` — 早 return GuidanceModal
- `src/pages/cms/CustomStageEditor.tsx` — textarea + 实时预览 + 列表合并 + preset 编辑

**Temporary (do NOT commit to feature PR):**
- `src/components/auth/CMSAuthGate.tsx` — dev-only bypass，单独 commit、本地测完 revert

---

## Task 1: Branch + dependencies

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1.1: Confirm clean working tree on main**

Run: `git status`
Expected: `On branch main … nothing to commit, working tree clean`（除了已有的 `?? docs/superpowers/`、`?? openspec/changes/add-stage-guidance/` 这些 spec 文件 — 这些先一起 stash 或第一个 commit 带上）

- [ ] **Step 1.2: Create feature branch**

Run: `git checkout -b feat/issue-14-stage-guidance`
Expected: `Switched to a new branch 'feat/issue-14-stage-guidance'`

- [ ] **Step 1.3: First commit — design + spec docs**

```bash
git add docs/superpowers/specs/2026-05-18-stage-guidance-design.md \
        docs/superpowers/plans/2026-05-19-stage-learning-guidance.md \
        openspec/changes/add-stage-guidance/
git commit -m "$(cat <<'EOF'
docs(spec): 闯关学习指导功能设计文档与 OpenSpec 提案 (#14)

新增需求 stage-guidance：教师端关卡编辑器支持 Markdown「学习指导」
输入，学生端进入闯关 quiz 前先看到全屏蒙层；支持「不再提示」复选框
与老师改 guidance 后自动重弹。
EOF
)"
```

- [ ] **Step 1.4: Install runtime dependencies**

Run: `npm i react-markdown@^9 remark-gfm@^4`
Expected: `added N packages`，无错误。检查 `package.json` 的 `dependencies` 多了这两条。

- [ ] **Step 1.5: Verify build still works**

Run: `npm run build`
Expected: 构建成功（无 TS 错误）。

- [ ] **Step 1.6: Commit dependencies**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add react-markdown and remark-gfm for stage guidance"
```

---

## Task 2: Extend CustomStage type and preset preservation

**Files:** `src/core/store/useAppStore.ts`

### Step 2.1: Add `guidance` field to CustomStage

- [ ] **Step 2.1**

Open `src/core/store/useAppStore.ts`. Find the `CustomStage` interface (line ~63):

```ts
export interface CustomStage {
  id: string;
  module: 'notes' | 'symbols' | 'theory' | 'patterns';
  title: string;
  sliceIds: string[]; // 引用 slicesPool 中的 id
  isPreset?: boolean;
}
```

Replace with:

```ts
export interface CustomStage {
  id: string;
  module: 'notes' | 'symbols' | 'theory' | 'patterns';
  title: string;
  sliceIds: string[]; // 引用 slicesPool 中的 id
  isPreset?: boolean;
  guidance?: string;  // 老师为该关卡撰写的「学习指导」Markdown 文本
}
```

### Step 2.2: Preserve guidance on preset regeneration

- [ ] **Step 2.2**

In the same file, find `generatePresetStages` (around line 203). Currently:

```ts
generatePresetStages: (moduleId) => set((state) => {
  // Remove old presets for this module
  const withoutOldPresets = state.customStages.filter(
    cs => !(cs.module === moduleId && cs.isPreset)
  );
  // Compute free pool (not used by non-preset custom stages)
  const usedByCustom = new Set(
    withoutOldPresets.filter(cs => cs.module === moduleId).flatMap(cs => cs.sliceIds)
  );
  const freePool = state.slicesPool.filter(s => !usedByCustom.has(s.id));
  const autoStages = autoGenerateStages(freePool).filter(s => s.module === moduleId);
  const presets: CustomStage[] = autoStages.map(s => ({
    id: s.id,
    module: moduleId as CustomStage['module'],
    title: s.title,
    sliceIds: s.slices.map(sl => sl.id),
    isPreset: true,
  }));
  const newCustomStages = [...withoutOldPresets, ...presets];
  ...
```

Replace with:

```ts
generatePresetStages: (moduleId) => set((state) => {
  // 先记录旧 preset 关卡的 guidance（按 id），新生成的同 id preset 沿用
  const oldGuidanceById = new Map<string, string>();
  for (const cs of state.customStages) {
    if (cs.module === moduleId && cs.isPreset && cs.guidance) {
      oldGuidanceById.set(cs.id, cs.guidance);
    }
  }
  // Remove old presets for this module
  const withoutOldPresets = state.customStages.filter(
    cs => !(cs.module === moduleId && cs.isPreset)
  );
  // Compute free pool (not used by non-preset custom stages)
  const usedByCustom = new Set(
    withoutOldPresets.filter(cs => cs.module === moduleId).flatMap(cs => cs.sliceIds)
  );
  const freePool = state.slicesPool.filter(s => !usedByCustom.has(s.id));
  const autoStages = autoGenerateStages(freePool).filter(s => s.module === moduleId);
  const presets: CustomStage[] = autoStages.map(s => ({
    id: s.id,
    module: moduleId as CustomStage['module'],
    title: s.title,
    sliceIds: s.slices.map(sl => sl.id),
    isPreset: true,
    guidance: oldGuidanceById.get(s.id),  // 没旧值则 undefined
  }));
  const newCustomStages = [...withoutOldPresets, ...presets];
  ...
```

（后面构建 `manualIds` 与返回 state 的代码保持不变。）

### Step 2.3: TypeScript build check

- [ ] **Step 2.3**

Run: `npm run build`
Expected: 无 TS 错误（`guidance` 是可选字段，所有现有代码兼容）。

### Step 2.4: Commit

- [ ] **Step 2.4**

```bash
git add src/core/store/useAppStore.ts
git commit -m "feat(store): add optional guidance field to CustomStage with preset preservation"
```

---

## Task 3: GuidanceModal component (TDD)

**Files:**
- Create: `src/components/GuidanceModal.test.tsx`
- Create: `src/components/GuidanceModal.tsx`

### Step 3.1: Write the failing test

- [ ] **Step 3.1**

Create `src/components/GuidanceModal.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import GuidanceModal from './GuidanceModal';

afterEach(() => cleanup());

describe('GuidanceModal', () => {
  it('renders the stage title and plain-text guidance', () => {
    render(<GuidanceModal title="第1关" guidance="hello world" onStart={() => {}} />);
    expect(screen.getByText('第1关')).toBeTruthy();
    expect(screen.getByText('hello world')).toBeTruthy();
  });

  it('renders markdown bold as <strong>', () => {
    const { container } = render(
      <GuidanceModal title="T" guidance="this is **bold**" onStart={() => {}} />
    );
    const strong = container.querySelector('strong');
    expect(strong).toBeTruthy();
    expect(strong?.textContent).toBe('bold');
  });

  it('renders markdown lists as <ul><li>', () => {
    const { container } = render(
      <GuidanceModal title="T" guidance={'- alpha\n- beta'} onStart={() => {}} />
    );
    const items = container.querySelectorAll('ul > li');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toBe('alpha');
    expect(items[1].textContent).toBe('beta');
  });

  it('renders markdown links as <a href> opening new tab', () => {
    const { container } = render(
      <GuidanceModal title="T" guidance="[click](https://example.com)" onStart={() => {}} />
    );
    const a = container.querySelector('a');
    expect(a).toBeTruthy();
    expect(a?.getAttribute('href')).toBe('https://example.com');
    expect(a?.getAttribute('target')).toBe('_blank');
    expect(a?.getAttribute('rel')).toContain('noopener');
  });

  it('does NOT render raw HTML (XSS-safe by default)', () => {
    const { container } = render(
      <GuidanceModal title="T" guidance={'<script>alert(1)</script>safe text'} onStart={() => {}} />
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('safe text');
  });

  it('calls onStart(false) when start button is clicked without checkbox', () => {
    const onStart = vi.fn();
    render(<GuidanceModal title="T" guidance="g" onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: /开始答题/ }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith(false);
  });

  it('calls onStart(true) when checkbox is ticked and start clicked', () => {
    const onStart = vi.fn();
    render(<GuidanceModal title="T" guidance="g" onStart={onStart} />);
    fireEvent.click(screen.getByLabelText(/不再提示/));
    fireEvent.click(screen.getByRole('button', { name: /开始答题/ }));
    expect(onStart).toHaveBeenCalledWith(true);
  });

  it('does NOT call onStart when backdrop is clicked', () => {
    const onStart = vi.fn();
    const { container } = render(
      <GuidanceModal title="T" guidance="g" onStart={onStart} />
    );
    const backdrop = container.querySelector('[data-testid="guidance-backdrop"]');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(onStart).not.toHaveBeenCalled();
  });
});
```

### Step 3.2: Verify testing-library is available

- [ ] **Step 3.2**

Run: `npm ls @testing-library/react vitest 2>&1 | head -10`

If `@testing-library/react` is missing, install:
```bash
npm i -D @testing-library/react @testing-library/jest-dom jsdom
```

Then ensure `vite.config.ts` has `test.environment: 'jsdom'`. If not, edit `vite.config.ts` to add to the test config:

```ts
test: { environment: 'jsdom' }
```

After install, also check `vitest.config.ts` or `vite.config.ts` for a `test` block.

- [ ] **Step 3.3: Run test to confirm it fails**

Run: `npx vitest run src/components/GuidanceModal.test.tsx`
Expected: All tests fail with "Cannot find module './GuidanceModal'" or similar.

### Step 3.4: Implement GuidanceModal

- [ ] **Step 3.4**

Create `src/components/GuidanceModal.tsx`:

```tsx
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  title: string;
  guidance: string;
  onStart: (dontShowAgain: boolean) => void;
}

export default function GuidanceModal({ title, guidance, onStart }: Props) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  return (
    <div
      data-testid="guidance-backdrop"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '12px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: '16px',
          width: '100%', maxWidth: '640px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        <div style={{ padding: '24px 28px 8px' }}>
          <div style={{ fontSize: '0.78rem', color: '#9ca3af', letterSpacing: '0.05em' }}>
            📖 学习指导
          </div>
          <h2 style={{ margin: '4px 0 0', fontSize: '1.25rem', color: '#1f2937', fontWeight: 800 }}>
            {title}
          </h2>
        </div>

        <div
          className="guidance-body"
          style={{
            padding: '12px 28px',
            overflowY: 'auto',
            color: '#374151',
            fontSize: '1rem',
            lineHeight: 1.7,
            flex: 1,
          }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
              ),
            }}
          >
            {guidance}
          </ReactMarkdown>
        </div>

        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '12px', padding: '16px 28px 24px',
            borderTop: '1px solid #f3f4f6', flexWrap: 'wrap',
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#6b7280', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            不再提示此关卡
          </label>
          <button
            onClick={() => onStart(dontShowAgain)}
            style={{
              padding: '12px 28px',
              minHeight: '48px',
              borderRadius: '12px', border: 'none',
              background: '#3b82f6', color: 'white',
              fontWeight: 700, fontSize: '1rem',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(59,130,246,0.35)',
            }}
          >
            开始答题
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Step 3.5: Run tests to confirm pass

- [ ] **Step 3.5**

Run: `npx vitest run src/components/GuidanceModal.test.tsx`
Expected: All 8 tests pass.

### Step 3.6: Run the full test suite

- [ ] **Step 3.6**

Run: `npm test`
Expected: All tests pass (no regression in existing tests).

### Step 3.7: Commit

- [ ] **Step 3.7**

```bash
git add src/components/GuidanceModal.tsx src/components/GuidanceModal.test.tsx
git commit -m "feat(component): GuidanceModal — Markdown overlay for stage entry"
```

---

## Task 4: Wire GuidanceModal into InteractiveQuiz

**Files:** `src/pages/client/InteractiveQuiz.tsx`

### Step 4.1: Add suppression helpers and modal state

- [ ] **Step 4.1**

In `src/pages/client/InteractiveQuiz.tsx`, find the imports block (lines 1-11). Append after the existing imports:

```tsx
import GuidanceModal from '../../components/GuidanceModal';
```

Then, *above* the `InteractiveQuiz` component (after the last helper function, around line 124, before `// 组件 ===...===`), add:

```tsx
const GUIDANCE_SUPPRESS_KEY = 'stage_guidance_suppressed';

function readSuppressedMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(GUIDANCE_SUPPRESS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeSuppressed(stageId: string, guidanceSnapshot: string): void {
  const map = readSuppressedMap();
  map[stageId] = guidanceSnapshot;
  localStorage.setItem(GUIDANCE_SUPPRESS_KEY, JSON.stringify(map));
}
```

### Step 4.2: Read guidance for current stage and early-return modal

- [ ] **Step 4.2**

In the `InteractiveQuiz` component body, find this block (around lines 136-154):

```tsx
  const [sessionKey] = useState(() => Math.random());

  const { stage, stageIndex } = useMemo(() => {
    ...
  }, [stageId, slicesPool, sessionKey]);
```

Right after that `useMemo`, add:

```tsx
  // ============================================================
  // 学习指导蒙层：进入有 guidance 的关卡时先展示，点「开始答题」后才进 quiz
  // ============================================================
  const customStages = useAppStore(state => state.customStages);
  const stageRecord = customStages.find(cs => cs.id === stageId);
  const guidance = stageRecord?.guidance?.trim() ?? '';

  const [introDismissed, setIntroDismissed] = useState(() => {
    if (!stageId || !guidance) return true;
    return readSuppressedMap()[stageId] === guidance;
  });

  if (!introDismissed && guidance && stageRecord) {
    return (
      <GuidanceModal
        title={stageRecord.title}
        guidance={guidance}
        onStart={(dontShowAgain) => {
          if (dontShowAgain && stageId) writeSuppressed(stageId, guidance);
          setIntroDismissed(true);
        }}
      />
    );
  }
```

**Important**: This early-return MUST be placed AFTER the `useMemo` for `stage` (so React's rules-of-hooks aren't violated by skipping `useState` calls below). Place it BEFORE the `const [currentSliceIndex, setCurrentSliceIndex] = useState(0);` line (around line 156).

Wait — this would skip the hooks below. We need to keep all hooks above the early return.

Let me restructure: ALL hooks must be called unconditionally. Place the guard hook setup at the top, but the early return only after all hooks.

**Revised approach**: Put `introDismissed` state and the modal check at the TOP of the function body but actually return only AFTER all hooks have been declared. The cleanest pattern:

Replace the entire body skeleton so that ALL `useState`/`useEffect`/`useMemo`/`useRef` hooks run first, then the early-return check happens AFTER all hooks are declared. Concretely:

1. Keep the order of all existing hooks unchanged.
2. Add the new hooks (`useState` for `introDismissed`, the store selector for `customStages`) BEFORE the existing `useState`/`useEffect` calls.
3. Place the early-return modal render AFTER all hook declarations but BEFORE the JSX `return`. Effects that already ran are harmless — VexFlow effect short-circuits when `currentSlice` is null.

Concretely, edit step:

Find line 132 `const slicesPool = useAppStore(state => state.slicesPool);` and immediately AFTER `const [sessionKey] = useState(() => Math.random());` (line 136), insert:

```tsx
  const customStages = useAppStore(state => state.customStages);
```

After the `useMemo` (line 154 end), insert:

```tsx
  const stageRecord = customStages.find(cs => cs.id === stageId);
  const guidance = stageRecord?.guidance?.trim() ?? '';
  const [introDismissed, setIntroDismissed] = useState(() => {
    if (!stageId || !guidance) return true;
    return readSuppressedMap()[stageId] === guidance;
  });
```

Then find the JSX return statement (the main `return ( <div ...> ... </div> )` of the component). RIGHT BEFORE that return, insert:

```tsx
  if (!introDismissed && guidance && stageRecord) {
    return (
      <GuidanceModal
        title={stageRecord.title}
        guidance={guidance}
        onStart={(dontShowAgain) => {
          if (dontShowAgain && stageId) writeSuppressed(stageId, guidance);
          setIntroDismissed(true);
        }}
      />
    );
  }
```

This satisfies React's rules of hooks: all hooks run unconditionally on every render; only the JSX output branches.

### Step 4.3: Locate the main JSX return

- [ ] **Step 4.3**

In `InteractiveQuiz.tsx`, find the final `return (` for the component's JSX (it's the one rendering the quiz UI, after all the helper handlers and useEffects). Search for `return (` and pick the one with the outer `<div` containing the quiz. Insert the guard block above it as described in Step 4.2.

### Step 4.4: Build and run tests

- [ ] **Step 4.4**

Run: `npm run build && npm test`
Expected: build succeeds, all tests pass.

### Step 4.5: Commit

- [ ] **Step 4.5**

```bash
git add src/pages/client/InteractiveQuiz.tsx
git commit -m "feat(client): show GuidanceModal before stage quiz when guidance is set"
```

---

## Task 5: CustomStageEditor — guidance textarea + preset edit

**Files:** `src/pages/cms/CustomStageEditor.tsx`

### Step 5.1: Add guidance state

- [ ] **Step 5.1**

In `src/pages/cms/CustomStageEditor.tsx`, find the existing import section (line 1):

```tsx
import { useState, useRef } from 'react';
import { useAppStore, type CustomStage, type AutoStage } from '../../core/store/useAppStore';
import { getStaffLabel } from '../../core/engine/pitchUtils';
```

Append after the `getStaffLabel` import line:

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
```

Then find the block of `useState` calls (around lines 31-38):

```tsx
  const [module, setModule] = useState<'notes' | 'symbols' | 'theory' | 'patterns'>('notes');
  const [stageName, setStageName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  ...
```

Right after `const [stageName, setStageName] = useState('');`, add:

```tsx
  const [guidance, setGuidance] = useState('');
```

### Step 5.2: Track editing-preset flag

- [ ] **Step 5.2**

Right after the `editingId` state line, add (still in the `useState` block):

```tsx
  const editingStage = editingId ? customStages.find(cs => cs.id === editingId) : null;
  const editingPreset = !!editingStage?.isPreset;
```

(`editingStage`/`editingPreset` are NOT hooks — they're derived values. Insert them just below the `useState` block, after `[msg, setMsg] = useState('')` line.)

### Step 5.3: Add textarea + preview to the create/edit form

- [ ] **Step 5.3**

Find the existing "关卡名称" block (around lines 165-174):

```tsx
        {/* 关卡名称 */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>关卡名称</label>
          <input
            type="text"
            value={stageName}
            onChange={e => setStageName(e.target.value)}
            placeholder="例如：基础单音识别、升降号练习..."
            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '1rem', boxSizing: 'border-box' }}
          />
        </div>
```

Replace with:

```tsx
        {/* 关卡名称 */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>
            关卡名称
            {editingPreset && <span style={{ marginLeft: 8, color: '#9ca3af', fontWeight: 400, fontSize: '0.8rem' }}>🔒 预设关卡不可改名</span>}
          </label>
          <input
            type="text"
            value={stageName}
            onChange={e => setStageName(e.target.value)}
            disabled={editingPreset}
            placeholder="例如：基础单音识别、升降号练习..."
            style={{
              width: '100%', padding: '10px 14px', borderRadius: '8px',
              border: '1px solid #d1d5db', fontSize: '1rem', boxSizing: 'border-box',
              background: editingPreset ? '#f3f4f6' : 'white',
              color: editingPreset ? '#9ca3af' : '#1f2937',
            }}
          />
        </div>

        {/* 学习指导（可选，支持 Markdown） */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>
            学习指导 <span style={{ color: '#9ca3af', fontWeight: 400 }}>（可选，支持 Markdown：**加粗**、- 列表、[链接](url)）</span>
          </label>
          <textarea
            value={guidance}
            onChange={e => setGuidance(e.target.value)}
            rows={5}
            placeholder={'例如：\n这一关主要练习升降号识别。\n\n**注意**：C# 和 Db 是同一个琴键。'}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: '8px',
              border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box',
              fontFamily: 'inherit', resize: 'vertical', minHeight: '100px',
            }}
          />
          {guidance.trim() && (
            <details open style={{ marginTop: '8px', background: '#f9fafb', borderRadius: '8px', padding: '10px 14px' }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: '#6b7280', fontWeight: 600 }}>👁 预览</summary>
              <div style={{ marginTop: '8px', color: '#374151', fontSize: '0.95rem', lineHeight: 1.65 }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
                  }}
                >{guidance}</ReactMarkdown>
              </div>
            </details>
          )}
        </div>
```

### Step 5.4: Disable slice selection when editing preset

- [ ] **Step 5.4**

Find the "题目勾选" block (around lines 176-200). The outer `<div style={{ marginBottom: '20px' }}>` wraps the label + filter + checkbox list. Add a disabled overlay when `editingPreset`. Replace the existing block opening:

```tsx
        {/* 题目勾选 */}
        <div style={{ marginBottom: '20px' }}>
```

With:

```tsx
        {/* 题目勾选 */}
        <div style={{ marginBottom: '20px', position: 'relative' }}>
          {editingPreset && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 2,
              background: 'rgba(243,244,246,0.85)',
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', padding: '20px', color: '#6b7280', fontWeight: 600,
              pointerEvents: 'all',
            }}>
              🔒 预设关卡的题目由系统自动生成，不可在此修改。<br/>
              如需调整题目，请先「取消预设」。
            </div>
          )}
```

(The closing `</div>` for this section already exists at line 269 — leave it.)

### Step 5.5: Hook guidance into handleCreate / handleUpdate / handleEdit / handleCancel

- [ ] **Step 5.5**

Find `handleCreate` (line ~80):

```tsx
  const handleCreate = () => {
    if (!stageName.trim()) return showMsg('请输入关卡名称');
    if (selectedIds.size === 0) return showMsg('至少选择 1 道题目');
    const stage: CustomStage = {
      id: `custom_${Date.now()}`,
      module,
      title: stageName.trim(),
      sliceIds: Array.from(selectedIds),
    };
    addCustomStage(stage);
    setStageName('');
    setSelectedIds(new Set());
    setDiffFilter(null);
    showMsg(`✓ 已创建关卡「${stage.title}」（${stage.sliceIds.length} 道题）`);
  };
```

Replace with:

```tsx
  const handleCreate = () => {
    if (!stageName.trim()) return showMsg('请输入关卡名称');
    if (selectedIds.size === 0) return showMsg('至少选择 1 道题目');
    const stage: CustomStage = {
      id: `custom_${Date.now()}`,
      module,
      title: stageName.trim(),
      sliceIds: Array.from(selectedIds),
      guidance: guidance.trim() || undefined,
    };
    addCustomStage(stage);
    setStageName('');
    setGuidance('');
    setSelectedIds(new Set());
    setDiffFilter(null);
    showMsg(`✓ 已创建关卡「${stage.title}」（${stage.sliceIds.length} 道题）`);
  };
```

Find `handleEdit` (line ~96):

```tsx
  const handleEdit = (cs: CustomStage) => {
    setEditingId(cs.id);
    setStageName(cs.title);
    setSelectedIds(new Set(cs.sliceIds));
    setModule(cs.module);
  };
```

Replace with:

```tsx
  const handleEdit = (cs: CustomStage) => {
    setEditingId(cs.id);
    setStageName(cs.title);
    setSelectedIds(new Set(cs.sliceIds));
    setModule(cs.module);
    setGuidance(cs.guidance ?? '');
  };
```

Find `handleUpdate` (line ~103):

```tsx
  const handleUpdate = () => {
    if (!editingId) return;
    if (!stageName.trim()) return showMsg('请输入关卡名称');
    if (selectedIds.size === 0) return showMsg('至少选择 1 道题目');
    updateCustomStage(editingId, { title: stageName.trim(), sliceIds: Array.from(selectedIds) });
    setEditingId(null);
    setStageName('');
    setSelectedIds(new Set());
    showMsg('✓ 关卡已更新');
  };
```

Replace with:

```tsx
  const handleUpdate = () => {
    if (!editingId) return;
    const isPreset = !!customStages.find(cs => cs.id === editingId)?.isPreset;
    if (!isPreset && !stageName.trim()) return showMsg('请输入关卡名称');
    if (!isPreset && selectedIds.size === 0) return showMsg('至少选择 1 道题目');
    const patch: Partial<CustomStage> = isPreset
      ? { guidance: guidance.trim() || undefined }
      : { title: stageName.trim(), sliceIds: Array.from(selectedIds), guidance: guidance.trim() || undefined };
    updateCustomStage(editingId, patch);
    setEditingId(null);
    setStageName('');
    setGuidance('');
    setSelectedIds(new Set());
    showMsg('✓ 关卡已更新');
  };
```

Find `handleCancel` (line ~114):

```tsx
  const handleCancel = () => {
    setEditingId(null);
    setStageName('');
    setSelectedIds(new Set());
  };
```

Replace with:

```tsx
  const handleCancel = () => {
    setEditingId(null);
    setStageName('');
    setGuidance('');
    setSelectedIds(new Set());
  };
```

### Step 5.6: Merge preset stages into the "all stages" list

- [ ] **Step 5.6**

Find this (line ~50):

```tsx
  const moduleStages = customStages.filter(cs => cs.module === module && !cs.isPreset);
```

Replace with:

```tsx
  const moduleStages = customStages.filter(cs => cs.module === module);
```

Find the heading of that section (around line ~374-380):

```tsx
        <h2 style={{ fontSize: '1.15rem', color: '#374151', fontWeight: 700, marginBottom: '14px' }}>
          当前模块的手动关卡
          <span style={{ marginLeft: '10px', fontSize: '0.85rem', color: '#9ca3af', fontWeight: 400 }}>
            （共 {moduleStages.length} 个）
          </span>
        </h2>
```

Replace with:

```tsx
        <h2 style={{ fontSize: '1.15rem', color: '#374151', fontWeight: 700, marginBottom: '14px' }}>
          当前模块的所有关卡
          <span style={{ marginLeft: '10px', fontSize: '0.85rem', color: '#9ca3af', fontWeight: 400 }}>
            （共 {moduleStages.length} 个）
          </span>
        </h2>
```

Find the empty-state message just below (line ~382-385):

```tsx
        {moduleStages.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', background: '#f9fafb', borderRadius: '12px', color: '#9ca3af' }}>
            暂无手动关卡，点击上方「创建关卡」按钮开始编排
          </div>
```

Replace with:

```tsx
        {moduleStages.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', background: '#f9fafb', borderRadius: '12px', color: '#9ca3af' }}>
            暂无关卡，请先点上方「生成预设关卡」或「创建关卡」
          </div>
```

### Step 5.7: Add preset tag and adjust delete in the list

- [ ] **Step 5.7**

Find this row content (around lines 393-411):

```tsx
                <div key={cs.id} style={{ borderRadius: '10px', border: `1px solid ${editingId === cs.id ? '#f59e0b' : '#e5e7eb'}`, borderLeft: `4px solid ${moduleColor}`, background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 18px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: `${moduleColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: moduleColor, fontWeight: 800, fontSize: '0.9rem', flexShrink: 0 }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: '#1f2937', marginBottom: '2px' }}>{cs.title}</div>
                      <div style={{ fontSize: '0.82rem', color: '#9ca3af' }}>{sliceCount} 道题</div>
                    </div>
                    <button onClick={() => setExpandedId(isExpanded ? null : cs.id)} ...>
                      {isExpanded ? '收起' : '查看'}
                    </button>
                    <button onClick={() => handleEdit(cs)} ...>
                      编辑
                    </button>
                    <button onClick={() => setDeleteTarget(cs)} ...>
                      删除
                    </button>
                  </div>
```

Replace the `<div style={{ flex: 1 }}>` and the delete button to:

1. Show preset tag next to title
2. Hide delete button for preset stages (deletion route for preset is "清除全部预设" elsewhere)

```tsx
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: '#1f2937', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {cs.title}
                        {cs.isPreset && (
                          <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: '#f3f4f6', color: '#9ca3af', fontWeight: 600 }}>
                            🔒 预设
                          </span>
                        )}
                        {cs.guidance?.trim() && (
                          <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: '#eff6ff', color: '#3b82f6', fontWeight: 600 }}>
                            📖 含指导
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#9ca3af' }}>{sliceCount} 道题</div>
                    </div>
                    <button onClick={() => setExpandedId(isExpanded ? null : cs.id)} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #d1d5db', background: isExpanded ? '#f3f4f6' : 'white', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                      {isExpanded ? '收起' : '查看'}
                    </button>
                    <button onClick={() => handleEdit(cs)} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                      编辑
                    </button>
                    {!cs.isPreset && (
                      <button onClick={() => setDeleteTarget(cs)} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: '#fee2e2', color: '#ef4444', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                        删除
                      </button>
                    )}
```

### Step 5.8: Show guidance in the expanded "查看" panel

- [ ] **Step 5.8**

Find the expanded panel (around lines 412-454):

```tsx
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {stageSlices.map(slice => {
                        ...
                      })}
                    </div>
                  )}
```

Replace with:

```tsx
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {cs.guidance?.trim() && (
                        <div style={{ background: '#f9fafb', padding: '12px 14px', borderRadius: '8px', marginBottom: '4px' }}>
                          <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: '6px', fontWeight: 600 }}>📖 学习指导</div>
                          <div style={{ color: '#374151', fontSize: '0.9rem', lineHeight: 1.65 }}>
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
                              }}
                            >{cs.guidance}</ReactMarkdown>
                          </div>
                        </div>
                      )}
                      {stageSlices.map(slice => {
                        const c = slice.content;
                        const label = (typeof c === 'string' ? c : c.raw || c.symbol || c.theory || c.pattern) || slice.id;
                        const isNew = (slice.createdAt || 0) > Date.now() - 10 * 60 * 1000;
                        return (
                          <div key={slice.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#374151' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '4px', background: `${TYPE_COLORS[slice.type]}18`, color: TYPE_COLORS[slice.type], fontWeight: 600, fontSize: '0.75rem' }}>{TYPE_LABELS[slice.type]}</span>
                            <span style={{ flex: 1 }}>{label}</span>
                            {slice.type === 'A' && (
                              <span style={{
                                padding: '1px 6px',
                                borderRadius: '4px',
                                border: '1px solid #e5e7eb',
                                color: '#6b7280',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                flexShrink: 0
                              }}>
                                {getStaffLabel(slice.content.pitch || slice.content.raw, slice.content.placement)}
                              </span>
                            )}
                            {isNew && (
                              <span style={{
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: '#fee2e2',
                                color: '#ef4444',
                                fontSize: '0.7rem',
                                fontWeight: 'bold',
                                flexShrink: 0
                              }}>
                                新
                              </span>
                            )}
                            <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>L{slice.difficulty}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
```

### Step 5.9: Build and run tests

- [ ] **Step 5.9**

Run: `npm run build && npm test`
Expected: build succeeds, all tests pass.

### Step 5.10: Lint touched files

- [ ] **Step 5.10**

Run:
```bash
npx eslint src/pages/cms/CustomStageEditor.tsx src/pages/client/InteractiveQuiz.tsx src/components/GuidanceModal.tsx src/components/GuidanceModal.test.tsx src/core/store/useAppStore.ts
```
Expected: no new lint errors on this branch (pre-existing errors are fine but should not increase).

### Step 5.11: Commit

- [ ] **Step 5.11**

```bash
git add src/pages/cms/CustomStageEditor.tsx
git commit -m "feat(cms): guidance textarea + preview + preset edit support (#14)"
```

---

## Task 6: Dev-only CMS auth bypass (local-only, separate commit)

**Files:** `src/components/auth/CMSAuthGate.tsx`

> ⚠️ This change is **local-only**. It MUST be reverted before opening the PR.

### Step 6.1: Add the bypass

- [ ] **Step 6.1**

In `src/components/auth/CMSAuthGate.tsx`, find:

```tsx
export default function CMSAuthGate({ children }: CMSAuthGateProps) {
  const { user, profile, loading, profileLoading, configured } = useAuth();
```

Insert immediately after the destructuring line:

```tsx
  // [LOCAL DEV ONLY] — REVERT BEFORE PR. Bypasses Supabase gate so we can
  // exercise the teacher UI locally without running Supabase. Not committed
  // to the feature PR (see plan Task 7.4).
  if (import.meta.env.DEV) return <>{children}</>;
```

### Step 6.2: Restart the dev server

- [ ] **Step 6.2**

If dev server is running, stop it. Then:

Run (background): `npm run dev`
Wait for `Local: http://localhost:<port>/`.

Open `/cms` — should land on the dashboard without auth.

### Step 6.3: Commit (separately, with a "do not merge" marker)

- [ ] **Step 6.3**

```bash
git add src/components/auth/CMSAuthGate.tsx
git commit -m "chore(dev): local-only CMS auth bypass (DO NOT MERGE — revert before PR)"
```

---

## Task 7: Manual smoke test

### Step 7.1: Seed test data

- [ ] **Step 7.1**

Open the app in browser:

1. Go to `/cms/parser` or `/cms/creator` and create at least 5 A-type (单音) test slices — e.g. C4, D4, E4, F4, G4.
2. Go to `/cms/stages`, choose module = `notes`.
3. Click「生成预设关卡」— a preset 第1关 (L?) should appear.

### Step 7.2: Teacher — add guidance to preset stage

- [ ] **Step 7.2**

1. In the "当前模块的所有关卡" list, click 「编辑」 on the preset stage.
2. Verify: 关卡名称 input is disabled and shows `🔒 预设关卡不可改名`; 题目勾选 area is greyed out with overlay text.
3. In the textarea, type some markdown:
   ```
   这是 **预设关卡** 的学习指导。

   - 重点 1：识别五线谱位置
   - 重点 2：80% 正确率
   ```
4. Verify: 「👁 预览」展开区实时渲染 markdown（粗体、列表）。
5. Click 「保存修改」. Form clears. Message shows `✓ 关卡已更新`.
6. Click 「编辑」 again on the same preset stage. Verify the textarea pre-populates with what was saved.
7. Click 「查看」 (instead of 编辑). Expanded panel shows 📖 学习指导 block with the rendered markdown.
8. Verify the row title now has 📖 含指导 tag.

### Step 7.3: Teacher — create manual stage with guidance

- [ ] **Step 7.3**

1. With "新建关卡" open, fill 关卡名称 = "我的练习", textarea = `**测试** [链接](https://example.com)`, pick 2-3 slices.
2. Click 「创建关卡」.
3. In the list, click 「查看」 → guidance block shows; link opens new tab when clicked.

### Step 7.4: Student — modal appears with markdown

- [ ] **Step 7.4**

1. Go to `/client/module/notes`.
2. Click the preset stage you edited in Step 7.2.
3. ✅ A full-screen modal appears with the title, markdown rendered. No quiz UI underneath.
4. Resize browser window to ~360px width (iPhone size, via DevTools device toolbar). Verify modal is responsive: card fills width minus margin; button still tappable.
5. Resize to ~768px (iPad). Verify card is centered, ~640px max.
6. Click 「开始答题」 → modal closes, quiz starts normally.

### Step 7.5: Student — "don't show again" works

- [ ] **Step 7.5**

1. Refresh the quiz page (`F5`). Modal reappears (no checkbox memory yet).
2. Tick 「☐ 不再提示此关卡」, click 「开始答题」.
3. Refresh again. ✅ Modal does NOT appear; quiz starts immediately.
4. Open DevTools → Application → Local Storage → verify `stage_guidance_suppressed` key has `{ "auto_notes_stage_1": "...the guidance text..." }`.

### Step 7.6: Student — teacher edit re-prompts

- [ ] **Step 7.6**

1. Go back to `/cms/stages` (teacher).
2. Edit the same preset stage's guidance — change one character (e.g. add `.` at end).
3. Save.
4. Go back to `/client/module/notes` and click the stage again.
5. ✅ Modal reappears because the snapshot mismatch is detected.

### Step 7.7: Student — empty guidance skips modal

- [ ] **Step 7.7**

1. Edit the manual stage you created in Step 7.3, clear the textarea, save.
2. Click that stage from `/client/module/notes`.
3. ✅ No modal; quiz starts immediately.

### Step 7.8: Preset re-generation preserves guidance

- [ ] **Step 7.8**

1. Ensure your preset stage has non-empty guidance from Step 7.2.
2. In `/cms/stages` click 「生成预设关卡」 again.
3. Click 「编辑」 on `第1关` — guidance textarea should still contain the previous text (by-id preservation).

If any step fails, stop and diagnose before pushing.

---

## Task 8: Strip dev-bypass and finalize

### Step 8.1: Revert the dev-bypass commit

- [ ] **Step 8.1**

Check git log:
```bash
git log --oneline -5
```

You should see the `chore(dev): local-only CMS auth bypass` commit. Revert it:

```bash
git revert <that-commit-sha> --no-edit
```

This creates a new commit that undoes the bypass — keeping a clean, auditable history. Alternative if no other commits depend on it: `git reset --soft HEAD~1 && git restore --staged src/components/auth/CMSAuthGate.tsx && git checkout -- src/components/auth/CMSAuthGate.tsx` to drop it entirely. **Use revert** for clarity.

### Step 8.2: Verify CMSAuthGate is back to original

- [ ] **Step 8.2**

```bash
git diff main -- src/components/auth/CMSAuthGate.tsx
```

Expected: empty diff (or no diff against main).

### Step 8.3: Validate OpenSpec

- [ ] **Step 8.3**

Run: `npx openspec validate add-stage-guidance --strict`
Expected: `Change 'add-stage-guidance' is valid`

### Step 8.4: Full test pass + build

- [ ] **Step 8.4**

```bash
npm test && npm run build
```
Expected: all green.

### Step 8.5: Mark tasks.md complete

- [ ] **Step 8.5**

Open `openspec/changes/add-stage-guidance/tasks.md` and tick every `- [ ]` to `- [x]` (use Edit's `replace_all` with caution; safer to manually edit).

Commit:
```bash
git add openspec/changes/add-stage-guidance/tasks.md
git commit -m "docs(openspec): mark add-stage-guidance tasks complete"
```

---

## Task 9: Push and open PR

### Step 9.1: Push branch

- [ ] **Step 9.1**

```bash
git push -u origin feat/issue-14-stage-guidance
```

### Step 9.2: Open PR

- [ ] **Step 9.2**

```bash
gh pr create --base main --head feat/issue-14-stage-guidance \
  --title "feat(stages): 闯关模式增加学习指导 (#14)" \
  --body "$(cat <<'EOF'
## Summary
- 实现 issue #14：闯关模式每一关开始前展示老师写的「学习指导」Markdown 文本。
- 教师端关卡编辑器加 textarea + 实时预览；预设关卡也能编辑 guidance（名称/题目锁住）。
- 学生端进有 guidance 的关卡时全屏蒙层 + 「开始答题」按钮；支持「不再提示」复选框；老师改 guidance 后自动重弹。
- 数据层：`CustomStage` 加可选 `guidance` 字段；preset 重新生成时按 id 保留。
- 响应式：PC / 平板 / 手机三档布局。

## Spec
- Design: `docs/superpowers/specs/2026-05-18-stage-guidance-design.md`
- OpenSpec: `openspec/changes/add-stage-guidance/`

## Test plan
- [x] `npm test` — 含 GuidanceModal 8 例 vitest 用例
- [x] 本地手工：教师端添 / 编辑 guidance（preset 与 manual 都覆盖）
- [x] 本地手工：学生端弹蒙层、勾「不再提示」、老师改后重弹、空 guidance 直接进
- [x] 三档视口 (PC/iPad/iPhone) 验证
- [ ] Preview deployment 用真 Supabase admin 账号最终验证（reviewer 可代验）

Closes #14.
EOF
)"
```

### Step 9.3: Surface PR URL

- [ ] **Step 9.3**

`gh pr create` prints the URL on success — relay to user.

---

## Self-Review Checklist (already done while drafting)

- ✅ Spec coverage:
  - `Stage Guidance Data Model` → Task 2.1, 2.2
  - `Teacher Guidance Editor` → Task 5 (textarea, 预览, preset editing, list merge)
  - `Student Guidance Modal` → Task 3 (component), Task 4 (wiring)
  - 抑制 + 老师改自动重弹 → Task 4 (helpers + state)
  - 响应式 → Task 3.4 modal styles + Task 7.4 manual viewport check
- ✅ No `TBD` / `TODO` / "handle edge cases" placeholders.
- ✅ Function names consistent: `readSuppressedMap`/`writeSuppressed` used in Task 4 only.
- ✅ Types consistent: `CustomStage.guidance?: string` used in Tasks 2, 4, 5.
- ✅ Dev-bypass treated as separate, reverted commit (Task 6 + Task 8.1).
- ✅ All code blocks contain runnable, complete content (no `…` placeholders in the code).
