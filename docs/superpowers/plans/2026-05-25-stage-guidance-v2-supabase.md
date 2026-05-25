# Stage Learning Guidance v2 (Supabase) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重新实现 issue #14 学习指导功能，对接 PR #17 (Supabase 迁移) 之后的新数据层。教师端在 `CustomStageEditor` 加 markdown textarea + 实时预览；学生端 `InteractiveQuiz` 进入有 guidance 的关卡时全屏蒙层；guidance 通过 `SupabaseStorageProvider` 持久化到 `public.stages` 表的新 `guidance` 列。

**Architecture:**
- DB：`public.stages` 新增可空列 `guidance TEXT`。手动写 SQL 到 Supabase Dashboard。
- 数据层：`CustomStage.guidance?: string` + `SupabaseStorageProvider` save/load 映射。
- 渲染层：复用 v1 的 `GuidanceModal`（react-markdown + remark-gfm）。
- 接入层：`InteractiveQuiz` 早 return 蒙层；`CustomStageEditor` 加 textarea + 预览。
- 抑制层：localStorage `stage_guidance_suppressed[stageId] === guidance` 字符串相等比较，老师改了自动重弹。

**Tech Stack:** TypeScript, React 19, zustand, Supabase JS SDK, react-markdown ^9, remark-gfm ^4, Vitest

**Spec:** `docs/superpowers/specs/2026-05-18-stage-guidance-design.md` （v1 设计文档继续适用，需小幅更新 §3 数据模型说明）

**Issue:** [#14](https://github.com/ppttzhu/00-SightReading_3.0/issues/14) ｜ Previous attempt: PR #16 (to be closed)

**Key simplifications vs v1:**
- 不再有 preset 关卡概念（main commit `434c833` 移除了）→ 删掉 v1 里 preset 编辑锁、🔒 预设 标签、preset 列表合并、preset 重新生成保留逻辑
- 数据进 Supabase 而非 zustand persist → 需要 SQL 迁移 + Provider 适配
- `CustomStage` 已有 `questionCount?: number` 字段 → `guidance?: string` 跟它平级

**Additions per user feedback (post-Task 4):**
- **换行**：引入 `remark-breaks` 插件，老师按 Enter 直接换行（不需要双空格或空行）
- **图片上传**：教师端支持点击/拖拽/粘贴上传图片到 Supabase Storage，自动在 textarea 插入 `![filename](url)` markdown；学生端用 react-markdown 默认渲染 `<img>`

---

## File Structure

**Create:**
- `docs/supabase/migration_add_stage_guidance.sql` — 一行 SQL ALTER TABLE
- `src/components/GuidanceModal.tsx` — 全屏蒙层组件（复用 v1）
- `src/components/GuidanceModal.test.tsx` — 9 例 vitest 测试（复用 v1）

**Modify:**
- `package.json` + `package-lock.json` — 加 react-markdown、remark-gfm
- `vite.config.ts` — 切到 `vitest/config` 引入并加 `test: { environment: 'jsdom' }`
- `src/core/store/useAppStore.ts` — `CustomStage.guidance?: string`
- `src/core/storage/SupabaseStorageProvider.ts` — StageRow 加 `guidance` 字段 + save/load 映射
- `src/core/storage/syncOps.ts` — 同步 stage 时一并写 guidance（与 SupabaseStorageProvider 平行）
- `src/pages/client/InteractiveQuiz.tsx` — 早 return GuidanceModal + suppression helpers
- `src/pages/cms/CustomStageEditor.tsx` — textarea + 实时预览 + 含指导 标签 + 「查看」展开渲染

---

## Task 1: Branch + dependencies + jsdom

> Branch `feat/issue-14-stage-guidance-v2` already exists off `origin/main` at the time of executing this plan.

### Step 1.1: Verify branch state

- [ ] Run: `git branch --show-current`
- [ ] Expect: `feat/issue-14-stage-guidance-v2`

### Step 1.2: Install runtime deps

- [ ] Run: `npm i react-markdown@^9 remark-gfm@^4`
- [ ] Run: `npm i -D @testing-library/react @testing-library/jest-dom jsdom`
- [ ] Expect: both succeed, package.json updated.

### Step 1.3: Wire jsdom into vitest

- [ ] Edit `vite.config.ts`:
  - Change `import { defineConfig } from 'vite'` → `import { defineConfig } from 'vitest/config'`
  - Add `test: { environment: 'jsdom' },` as a sibling of `plugins` / `server`.

### Step 1.4: Build sanity

- [ ] Run: `npm run build`
- [ ] Expect: success, no TS errors.

### Step 1.5: Commit infra

```bash
git add package.json package-lock.json vite.config.ts
git commit -m "chore(deps): add react-markdown, remark-gfm, jsdom + testing-library for stage guidance"
```

---

## Task 2: SQL migration file

### Step 2.1: Create migration file

- [ ] Create `docs/supabase/migration_add_stage_guidance.sql`:

```sql
-- ============================================================
-- Migration: 在 stages 表上加 guidance 列（学习指导 Markdown 文本）
-- 前置依赖：sightreading.sql + migration_quiz_schema.sql 已执行
-- 幂等：可重复运行（IF NOT EXISTS）
-- 配套 PR：feat(stages): 闯关模式增加学习指导 (#14 v2)
-- ============================================================

ALTER TABLE public.stages
    ADD COLUMN IF NOT EXISTS guidance TEXT;

COMMENT ON COLUMN public.stages.guidance IS '老师为该关卡撰写的「学习指导」Markdown 文本；NULL 或空字符串视为无指导';
```

### Step 2.2: Commit

```bash
git add docs/supabase/migration_add_stage_guidance.sql
git commit -m "feat(db): add guidance column to stages table for learning guidance (#14)"
```

---

## Task 3: Extend CustomStage type

### Step 3.1: Add guidance field

- [ ] In `src/core/store/useAppStore.ts`, find:

```ts
export interface CustomStage {
  id: string;
  module: 'notes' | 'symbols' | 'theory' | 'patterns';
  title: string;
  sliceIds: string[];
  isPreset?: boolean;
  questionCount?: number;
}
```

Replace with:

```ts
export interface CustomStage {
  id: string;
  module: 'notes' | 'symbols' | 'theory' | 'patterns';
  title: string;
  sliceIds: string[];
  isPreset?: boolean;
  questionCount?: number;
  guidance?: string;  // 老师为该关卡撰写的「学习指导」Markdown 文本
}
```

### Step 3.2: Confirm updateCustomStage signature accepts guidance

- [ ] Locate `updateCustomStage` (around line 87 in v1; verify current line in this file).
- [ ] If signature is `Partial<Pick<CustomStage, 'title' | 'sliceIds'>>` or similar narrow form, widen to `Partial<CustomStage>` so `guidance` is accepted in patches.

### Step 3.3: Build sanity

```bash
npm run build
```

### Step 3.4: Commit

```bash
git add src/core/store/useAppStore.ts
git commit -m "feat(store): add optional guidance field to CustomStage"
```

---

## Task 4: SupabaseStorageProvider — guidance round-trip

### Step 4.1: Extend StageRow type

- [ ] In `src/core/storage/SupabaseStorageProvider.ts`, find the `StageRow` type:

```ts
type StageRow = {
  id: string;
  module: 'notes' | 'symbols' | 'theory' | 'patterns';
  title: string;
  is_preset: boolean;
  sort_index: number;
  question_count: number;
  del_status: boolean;
};
```

Replace with:

```ts
type StageRow = {
  id: string;
  module: 'notes' | 'symbols' | 'theory' | 'patterns';
  title: string;
  is_preset: boolean;
  sort_index: number;
  question_count: number;
  guidance: string | null;
  del_status: boolean;
};
```

### Step 4.2: Send guidance on save

- [ ] In `save()`, find the `stageRows.push({...})` block (around line 134-141) and add `guidance: stage.guidance ?? null,` to it.

### Step 4.3: SELECT guidance on load

- [ ] In `load()`, find the `client.from('stages').select(...)` query (around line 245-247) and update the select string to:

```ts
.select('id,module,title,is_preset,sort_index,question_count,guidance,del_status')
```

### Step 4.4: Map row → CustomStage with guidance

- [ ] In `load()`, find the `customStages: CustomStage[] = stageRows.map((row) => ({ ... }))` and add `guidance: row.guidance ?? undefined,` to the object literal.

### Step 4.5: Mirror change in syncOps.ts

- [ ] Open `src/core/storage/syncOps.ts`. Search for `is_preset: Boolean(stage.isPreset)` (around line 139).
- [ ] Identify whether `syncOps.ts` also upserts to `stages` table. If yes, add `guidance: stage.guidance ?? null,` next to the `is_preset` line. Also extend any SELECT-from-stages call to include `guidance`.

### Step 4.6: Build + run existing tests

```bash
npm run build && npm test
```

Expected: build clean, existing tests still pass (no DOM-specific changes yet).

### Step 4.7: Commit

```bash
git add src/core/storage/SupabaseStorageProvider.ts src/core/storage/syncOps.ts
git commit -m "feat(storage): persist CustomStage.guidance via Supabase stages table"
```

---

## Task 5: GuidanceModal component (TDD — verify reused code is still green)

### Step 5.1: Drop in the component and tests

- [ ] Copy `/tmp/guidance-stash/GuidanceModal.tsx` → `src/components/GuidanceModal.tsx`
- [ ] Copy `/tmp/guidance-stash/GuidanceModal.test.tsx` → `src/components/GuidanceModal.test.tsx`

(If `/tmp/guidance-stash` is unavailable, re-create using the spec from `docs/superpowers/specs/2026-05-18-stage-guidance-design.md` §4.1.)

### Step 5.2: Verify tests pass

- [ ] Run: `npx vitest run src/components/GuidanceModal.test.tsx`
- [ ] Expect: 9/9 pass (8 original + Esc lock-out from v1 fix).

### Step 5.3: Commit

```bash
git add src/components/GuidanceModal.tsx src/components/GuidanceModal.test.tsx
git commit -m "feat(component): GuidanceModal — Markdown overlay with Esc/backdrop lock (#14)"
```

---

## Task 6: Wire GuidanceModal into InteractiveQuiz

### Step 6.1: Helpers + import

- [ ] In `src/pages/client/InteractiveQuiz.tsx`, append to the imports block:

```tsx
import GuidanceModal from '../../components/GuidanceModal';
```

- [ ] Just above the `InteractiveQuiz` component declaration (after all helper functions), add:

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
  try {
    const map = readSuppressedMap();
    map[stageId] = guidanceSnapshot;
    localStorage.setItem(GUIDANCE_SUPPRESS_KEY, JSON.stringify(map));
  } catch {
    /* localStorage 写入失败时静默（Safari Private / quota）；下次进关会照常弹蒙层 */
  }
}
```

### Step 6.2: Read guidance + initialize introDismissed

- [ ] Inside the `InteractiveQuiz` function body, AFTER the existing `useMemo` that computes `{ stage, stageIndex }` and BEFORE the next `useState`/`useEffect`, add:

```tsx
  const customStages = useAppStore(state => state.customStages);
  const stageRecord = customStages.find(cs => cs.id === stageId);
  const guidance = stageRecord?.guidance?.trim() ?? '';
  const [introDismissed, setIntroDismissed] = useState(() => {
    if (!stageId || !guidance) return true;
    return readSuppressedMap()[stageId] === guidance;
  });
```

### Step 6.3: Add introDismissed to dep arrays of effects that depend on DOM/ref

- [ ] Find every `useEffect` whose body references `containerRef.current` (the VexFlow rendering effect) or that resets/runs a blink loop on `[currentSliceIndex]`. Append `introDismissed` to their dep arrays:

```tsx
}, [currentSliceIndex, introDismissed]);
```

```tsx
}, [currentSlice, introDismissed]);
```

This is the v1 "blank-card" fix carried over: useEffects that ran while modal hid the JSX must re-fire after modal dismiss so VexFlow re-renders into the now-mounted container.

### Step 6.4: Early-return modal BEFORE main JSX return

- [ ] Find the main JSX `return (` (the one rendering the quiz UI). RIGHT BEFORE it, add:

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

This MUST be placed AFTER all React hooks (Rules of Hooks).

### Step 6.5: Build + run tests

```bash
npm run build && npm test
```

Expected: all green.

### Step 6.6: Commit

```bash
git add src/pages/client/InteractiveQuiz.tsx
git commit -m "feat(client): show GuidanceModal before stage quiz when guidance is set"
```

---

## Task 7: Wire CustomStageEditor — textarea + preview + image upload + list badge

This is the biggest task. It adds:
- Markdown textarea with guidance state
- Live preview (`<details open>`) using react-markdown + remark-gfm + remark-breaks + img constraint
- 📷 Image upload button (file picker)
- Paste handler — clipboardData image/* → upload + insert markdown at cursor
- Drop handler — drag files onto textarea → upload + insert at cursor
- 📖 含指导 badge in stage list
- Guidance render in expanded/view panel (if any)
- Sync guidance state in handleCreate / handleEdit / handleUpdate / handleCancel

### Step 7.1: Imports + ref

- [ ] In `src/pages/cms/CustomStageEditor.tsx`, after existing imports add:

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { uploadGuidanceImage, GuidanceImageUploadError } from '../../components/guidanceImageUpload';
```

Also change the React import to include `useRef` if not already:
```tsx
import { useState, useRef } from 'react';
```

### Step 7.2: Add guidance state + textarea ref + upload status state

- [ ] In the useState block (around lines 25-32), after `setStageName`:

```tsx
  const [guidance, setGuidance] = useState('');
  const [uploadStatus, setUploadStatus] = useState<{ kind: 'idle' } | { kind: 'uploading'; name: string } | { kind: 'error'; msg: string }>({ kind: 'idle' });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
```

### Step 7.3: insertAtCursor helper + upload runner

- [ ] Right after the `const showMsg = ...` line (or near other helpers), add:

```tsx
  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setGuidance(g => g + text);
      return;
    }
    const start = ta.selectionStart ?? guidance.length;
    const end = ta.selectionEnd ?? guidance.length;
    const next = guidance.slice(0, start) + text + guidance.slice(end);
    setGuidance(next);
    // 恢复光标位置到插入文本之后
    requestAnimationFrame(() => {
      ta.focus();
      const caret = start + text.length;
      ta.setSelectionRange(caret, caret);
    });
  };

  const runUpload = async (file: File) => {
    setUploadStatus({ kind: 'uploading', name: file.name });
    try {
      const url = await uploadGuidanceImage(file);
      const alt = file.name.replace(/\.[^.]+$/, '');
      insertAtCursor(`![${alt}](${url})`);
      setUploadStatus({ kind: 'idle' });
    } catch (e) {
      const msg = e instanceof GuidanceImageUploadError ? e.message : String(e);
      setUploadStatus({ kind: 'error', msg });
      setTimeout(() => setUploadStatus({ kind: 'idle' }), 4000);
    }
  };

  const runUploads = async (files: File[]) => {
    const images = files.filter(f => f.type.startsWith('image/'));
    for (const file of images) {
      await runUpload(file);
    }
  };
```

### Step 7.4: Replace the name+count row with name+count and add the guidance block

- [ ] After the closing `</div>` of "关卡名称 + 题数" flex row (find by searching `marginBottom: '18px', display: 'flex', gap: '12px'`), insert:

```tsx
        {/* 学习指导（可选，支持 Markdown + 换行 + 图片上传） */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>
              学习指导 <span style={{ color: '#9ca3af', fontWeight: 400 }}>（可选，支持 Markdown，回车直接换行，可贴/拖图片）</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {uploadStatus.kind === 'uploading' && (
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>⏳ 上传中：{uploadStatus.name}</span>
              )}
              {uploadStatus.kind === 'error' && (
                <span style={{ fontSize: '0.8rem', color: '#ef4444' }}>⚠️ {uploadStatus.msg}</span>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length > 0) runUploads(files);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadStatus.kind === 'uploading'}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}
              >
                📷 插入图片
              </button>
            </div>
          </div>
          <textarea
            ref={textareaRef}
            value={guidance}
            onChange={e => setGuidance(e.target.value)}
            rows={5}
            placeholder={'例如：\n这一关主要练习升降号识别。\n\n**注意**：C# 和 Db 是同一个琴键。\n\n（直接拖拽或粘贴图片即可上传）'}
            onPaste={(e) => {
              const items = Array.from(e.clipboardData?.items ?? []);
              const images: File[] = [];
              for (const item of items) {
                if (item.kind === 'file' && item.type.startsWith('image/')) {
                  const f = item.getAsFile();
                  if (f) images.push(f);
                }
              }
              if (images.length > 0) {
                e.preventDefault();
                runUploads(images);
              }
            }}
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => {
              const files = Array.from(e.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'));
              if (files.length > 0) {
                e.preventDefault();
                runUploads(files);
              }
            }}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: '8px',
              border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box',
              fontFamily: 'inherit', resize: 'vertical', minHeight: '120px',
            }}
          />
          {guidance.trim() && (
            <details open style={{ marginTop: '8px', background: '#f9fafb', borderRadius: '8px', padding: '10px 14px' }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.85rem', color: '#6b7280', fontWeight: 600 }}>👁 预览</summary>
              <div style={{ marginTop: '8px', color: '#374151', fontSize: '0.95rem', lineHeight: 1.65 }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                  components={{
                    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
                    img: ({ src, alt }) => (
                      <img
                        src={src}
                        alt={alt ?? ''}
                        style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', display: 'block', margin: '8px 0' }}
                      />
                    ),
                  }}
                >{guidance}</ReactMarkdown>
              </div>
            </details>
          )}
        </div>
```

### Step 7.5: Update handleCreate / handleEdit / handleUpdate / handleCancel to sync guidance

- [ ] In `handleCreate`, add `guidance: guidance.trim() || undefined,` to the stage object literal (before `addCustomStage(stage);`); also add `setGuidance('');` next to the existing `setStageName('');`.
- [ ] In `handleEdit`, add `setGuidance(cs.guidance ?? '');`.
- [ ] In `handleUpdate`, add `guidance: guidance.trim() || undefined,` to the patch object passed to `updateCustomStage`; also `setGuidance('');` next to `setStageName('');`.
- [ ] In `handleCancel`, add `setGuidance('');` next to `setStageName('');`.

### Step 7.6: Add 「📖 含指导」badge in the stage list

- [ ] Locate the stage list rendering (search for `cs.title` in the file). Add a badge next to title:

```tsx
{cs.guidance?.trim() && (
  <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: '#eff6ff', color: '#3b82f6', fontWeight: 600, marginLeft: '8px' }}>
    📖 含指导
  </span>
)}
```

### Step 7.7: Render guidance in expanded/view panel if it exists

- [ ] If there's an expanded panel showing slice details (search for "查看" or expansion logic), prepend a guidance block above the slice list:

```tsx
{cs.guidance?.trim() && (
  <div style={{ background: '#f9fafb', padding: '12px 14px', borderRadius: '8px', marginBottom: '8px' }}>
    <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: '6px', fontWeight: 600 }}>📖 学习指导</div>
    <div style={{ color: '#374151', fontSize: '0.9rem', lineHeight: 1.65 }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
          img: ({ src, alt }) => (
            <img src={src} alt={alt ?? ''} style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', display: 'block', margin: '8px 0' }} />
          ),
        }}
      >{cs.guidance}</ReactMarkdown>
    </div>
  </div>
)}
```

If no expanded panel exists, skip this step and rely on manual verification.

### Step 7.8: Build + tests + lint

```bash
npm run build && npm test
npx eslint src/components/GuidanceModal.tsx src/components/GuidanceModal.test.tsx src/components/guidanceImageUpload.ts src/pages/client/InteractiveQuiz.tsx src/pages/cms/CustomStageEditor.tsx src/core/store/useAppStore.ts src/core/storage/SupabaseStorageProvider.ts src/core/storage/syncOps.ts
```

Expected: build clean, tests green (131+), no NEW lint errors on touched files (pre-existing OK).

### Step 7.9: Commit

```bash
git add src/pages/cms/CustomStageEditor.tsx
git commit -m "feat(cms): guidance textarea + markdown preview + image upload (paste/drop/click) (#14)"
```

---

## Task 8: Restore design docs + openspec change

### Step 8.1: Drop back the design doc (with small update for Supabase)

- [ ] Copy `/tmp/guidance-stash/2026-05-18-stage-guidance-design.md` → `docs/superpowers/specs/2026-05-18-stage-guidance-design.md`
- [ ] Edit §3 "Data Model" to mention Supabase `stages.guidance` column instead of zustand-only persistence. (Note: design doc largely unchanged, just one paragraph.)

### Step 8.2: Drop back the openspec change folder

- [ ] Copy `/tmp/guidance-stash/add-stage-guidance/` → `openspec/changes/add-stage-guidance/`
- [ ] Edit `openspec/changes/add-stage-guidance/specs/stage-guidance/spec.md` to:
  - Remove "Preset 关卡也可编辑指导" scenario (preset feature removed)
  - Remove "Preset 重新生成保留 guidance" scenario
  - Remove "关卡列表同时显示预设与手动" scenario
  - Keep all other requirements & scenarios (Data Model, Teacher Guidance Editor minus preset bits, Student Guidance Modal full)
- [ ] Edit `openspec/changes/add-stage-guidance/tasks.md` to reflect the v2 task list (delete preset-related tasks; add SQL migration task).
- [ ] Run: `npx openspec validate add-stage-guidance --strict`
- [ ] Expect: valid.

### Step 8.3: Drop back this plan file (already created above)

- [ ] Confirm `docs/superpowers/plans/2026-05-25-stage-guidance-v2-supabase.md` is in place.

### Step 8.4: Commit docs

```bash
git add docs/superpowers/specs/2026-05-18-stage-guidance-design.md \
        docs/superpowers/plans/2026-05-25-stage-guidance-v2-supabase.md \
        openspec/changes/add-stage-guidance/
git commit -m "docs(spec): 学习指导功能设计+OpenSpec 提案 (Supabase 适配版本)"
```

---

## Task 9: Push + open new PR (close PR #16)

### Step 9.1: Push

```bash
git push -u origin feat/issue-14-stage-guidance-v2
```

### Step 9.2: Close PR #16 with link to v2

```bash
gh pr close 16 --comment "Superseded by v2 PR (Supabase-adapted)."
```

### Step 9.3: Open new PR

```bash
gh pr create --base main --head feat/issue-14-stage-guidance-v2 \
  --title "feat(stages): 闯关模式增加学习指导 (#14, Supabase-adapted)" \
  --body "$(cat <<'EOF'
## Summary

实现 issue #14：闯关模式每关进入前展示老师写的「学习指导」Markdown，对接 PR #17 (Supabase 迁移) 之后的新数据层。

- **DB**：`stages` 表新增 `guidance TEXT` 可空列（SQL migration in `docs/supabase/migration_add_stage_guidance.sql`）
- **教师端**：`CustomStageEditor` 加 markdown textarea + 实时预览；列表加「📖 含指导」标签
- **学生端**：`InteractiveQuiz` 进入有 guidance 的关卡时全屏蒙层 + 「开始答题」按钮；「不再提示」复选框；老师改 guidance 后自动重弹
- **数据层**：`CustomStage.guidance?: string`；`SupabaseStorageProvider` save/load 一并 round-trip guidance；`syncOps` 同步

## Required deployment step

⚠️ **Before merging**: run `docs/supabase/migration_add_stage_guidance.sql` in Supabase Dashboard SQL Editor. The column is nullable so old client without this code is unaffected, but the new client requires the column to exist.

## Spec / Plan
- Design: `docs/superpowers/specs/2026-05-18-stage-guidance-design.md`
- Plan: `docs/superpowers/plans/2026-05-25-stage-guidance-v2-supabase.md`
- OpenSpec: `openspec/changes/add-stage-guidance/`
- Supersedes: #16

## Test plan
- [x] `npm test` — GuidanceModal 9 例 vitest 用例
- [x] `npm run build` — TypeScript clean
- [x] `openspec validate add-stage-guidance --strict`
- [ ] Preview deployment: run SQL migration, log in as admin, create stage with guidance, verify round-trip
- [ ] Preview deployment: student-side modal + suppression + teacher-edit re-prompt + responsive viewports

Closes #14.
EOF
)"
```

---

## Self-Review Checklist

- ✅ DB migration is additive and nullable — backward-compatible with old client
- ✅ `CustomStage.guidance?: string` is optional; no Supabase migration for existing rows needed (default NULL)
- ✅ `SupabaseStorageProvider.save()` writes `null` when undefined — matches column nullability
- ✅ `SupabaseStorageProvider.load()` maps DB `null` back to `undefined` on the client (idiomatic in TS)
- ✅ `GuidanceModal` is reused from v1 (TDD verified there); ensure Esc + backdrop lock both still present
- ✅ `introDismissed` hooked into VexFlow + blink useEffect deps (v1 blank-card fix carried over)
- ✅ `writeSuppressed` wraps localStorage.setItem in try/catch (Safari Private safety)
- ✅ Preset-specific UI/logic from v1 dropped (preset feature removed from main)
- ✅ No new lint regressions on touched files
- ✅ SQL migration file is idempotent (`ADD COLUMN IF NOT EXISTS`)
