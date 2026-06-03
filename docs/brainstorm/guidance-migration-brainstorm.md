# Brainstorm: Migrating Guidance + Image Upload from CustomStageEditor to AdventureEditor

## 1. Problem Analysis

### Current Architecture

```
CustomStage (local store)
  └── guidance?: string        ← Markdown learning guidance for the stage
  └── title, sliceIds, ...     ← Other stage fields

AdventureStage (local store)
  └── description?: string      ← Currently overloaded: stores sourceStage.guidance
  └── title, levelNum, ...      ← Other stage fields

SQL `adventure_routes` table:
  └── description TEXT           ← Currently receives sourceStage.guidance at addToRoute()

Student-side lookup (InteractiveQuiz.tsx L242-L248):
  const stageRecord = customStages.find(cs => cs.id === stageId);
  const guidance = stageRecord?.guidance?.trim() ?? '';
  // BUG: For adventure stages, stageId = "adventure_route_xxx", which never
  //      matches any customStage.id. So guidance is ALWAYS empty for adventure stages.
```

### Root Issues

1. **Field overload**: `AdventureStage.description` currently serves double duty -- it is text shown on the stage card in both CMS and student UI, AND it is populated from `sourceStage.guidance`. These two concepts must be split.

2. **Missing guidance field**: There is no `guidance` field on `AdventureStage` or the `adventure_routes` table.

3. **Student-side bug**: The `InteractiveQuiz` component looks up guidance by `stageId` in `customStages`, which never works for adventure stages (they have a different ID prefix).

4. **No edit UI for guidance**: The AdventureEditor's `EditableFields` component only edits title + description. There is no guidance editor, no Markdown textarea, no image upload.

5. **Data flow co-dependency**: `addToRoute()` in AdventureEditor populates `description` from `sourceStage.guidance`. This means the description field of an adventure stage is overwritten whenever the source custom stage's guidance changes (only at addToRoute time, but it creates conceptual coupling).

---

## 2. Architectural Approaches

### Option A (Recommended): Add `guidance` to AdventureStage + adventure_routes table

**What changes:**
- Add `guidance?: string` to `AdventureStage` interface
- Add `guidance TEXT` column to `adventure_routes` table
- Update `addToRoute()` to NOT set `description` from `sourceStage.guidance` -- instead, copy `sourceStage.guidance` into the new `guidance` field
- Update `getAdventureStages()` to use `stage.guidance || sourceStage.guidance` for display
- Keep `AdventureStage.description` for its true purpose: text shown on stage cards
- Add guidance editor UI in the AdventureEditor edit modal
- Update student-side `InteractiveQuiz` to look up `stage.guidance` for adventure stages

**Pros:**
- Clean separation of concerns
- `description` regains its true purpose (card display text)
- Backwards compatible: existing data migration is a simple column addition
- AdventureEditor can independently set guidance without touching the source custom stage
- Image upload infrastructure (Supabase Storage bucket, `uploadGuidanceImage()`) reuses directly

**Cons:**
- Requires SQL migration
- Existing adventure routes with `description` populated from guidance will need data cleanup
- Need to decide: when an adventure stage's guidance is empty, fall back to `sourceStage.guidance`?

**Data flow after change:**
```typescript
// addToRoute() - revised
addAdventureStage({
  title: source.title,
  description: '',  // explicitly empty; teacher fills it on the adventure stage card
  guidance: source.guidance || '',  // carry over source guidance as starting point
  sourceStageId: source.id,
  ...
});

// getAdventureStages() - revised
description: stage.description,  // card text - what the teacher explicitly set
guidance: stage.guidance || sourceStage.guidance,  // learning content - fallback to source
```

**Student-side guidance lookup - revised:**
```typescript
const adventureStages = useAppStore.getState().getAdventureStages();
const adventureStage = adventureStages.find(s => s.id === stageId);
const customStage = customStages.find(cs => cs.id === stageId);

// For adventure stages, check the auto-stage's description field (which is guidance)
// For custom stages, check the custom stage's guidance field
const guidance = stageId?.startsWith('adventure_route_')
  ? (adventureStage?.description?.trim() ?? '')
  : (customStage?.guidance?.trim() ?? '');
```
Wait -- this is suboptimal. The `AutoStage` type has `description` but not `guidance`. If we add guidance to `AutoStage`, the student lookup becomes clean.

---

### Option B: Proxied Editing (edit source CustomStage.guidance from AdventureEditor)

**What changes:**
- AdventureEditor edit modal opens the source `CustomStage` for editing
- Changes to `CustomStage.guidance` propagate to all adventure stages referencing it
- No changes to `AdventureStage` or `adventure_routes` data model

**Pros:**
- No schema changes needed
- Single source of truth
- Simplest to implement

**Cons:**
- **MAJOR**: Multiple adventure stages can reference the same custom stage. Editing guidance for one affects ALL of them.
- Editing a source stage from a downstream reference is conceptually confusing
- If a custom stage is deleted, the adventure stage loses its guidance
- Teacher cannot customize guidance per adventure stage

**Verdict: Rejected** -- too many edge cases and confusing UX.

---

### Option C: Keep guidance on CustomStage, but allow AdventureStage override

**What changes:**
- Add `guidanceOverride?: string` to `AdventureStage`
- Add `guidance_override TEXT` column to `adventure_routes`
- `getAdventureStages()` resolves: `stage.guidanceOverride || sourceStage.guidance`
- Student-side reads guidance from the resolved `AutoStage`

**Pros:**
- Backwards compatible (existing data falls through to source guidance)
- Teacher can optionally override guidance per adventure stage
- No data migration needed for existing records

**Cons:**
- Two sources of truth for guidance (messy mental model)
- CustomStage deletion still breaks guidance
- Guidance editing flow is confusing: "am I editing the source or the override?"
- More conditional logic in multiple places

**Verdict: Possible but creates confusion. Over-engineered for the use case.**

---

### Option D: Separate guidance entity table

**What changes:**
- New SQL table `adventure_guidance` with `(stage_id TEXT PK, content TEXT)`
- No changes to `AdventureStage` interface
- AdventureEditor loads/saves guidance independently via this table
- Student-side fetches guidance from this table

**Pros:**
- Cleanest data model (no schema changes to existing tables)
- Independent lifecycle from both custom stage and adventure route

**Cons:**
- Requires a completely new SQL table + CRUD operations
- Additional network requests for student-side (or pre-loading logic)
- Over-engineering for a feature that maps 1:1 with adventure stages
- More complex sync logic

**Verdict: Rejected** -- too heavy for what is essentially a text field on an existing entity.

---

## 3. Recommended Approach: Option A (Detailed Design)

### 3.1 Data Model Changes

**AdventureStage interface** (in `useAppStore.ts`):
```typescript
export interface AdventureStage {
  id: string;
  title: string;
  description?: string;   // Stage card display text (e.g., "练习升降号识别")
  guidance?: string;       // Learning guidance Markdown (shown in modal before quiz)
  levelNum: number;
  sourceStageId: string;
  sourceModule: QuizModuleId;
  questionCount: number;
  unlockRule: 'previous_clear';
  source?: 'manual' | 'assistant';
  createdAt?: number;
  updatedAt?: number;
}
```

**AutoStage interface** (used for student display):
```typescript
export interface AutoStage {
  id: string;
  module: string;
  stageNum: number;
  title: string;
  description?: string;    // Card display text
  guidance?: string;       // ← NEW: learning guidance
  slices: Slice[];
  questionCount: number;
}
```

### 3.2 SQL Migration

New migration file: `docs/data/migrate-adventure-guidance.sql`

```sql
-- ============================================================
-- Migration: Add guidance column to adventure_routes table
-- ============================================================

-- Step 1: Add the new column
ALTER TABLE public.adventure_routes
ADD COLUMN IF NOT EXISTS guidance TEXT;

-- Step 2: Migrate existing data
-- Previously, the addToRoute() function did:
--   description: sourceStage.guidance
-- So guidance content is currently stored in the description column.
-- We need to COPY description → guidance for rows where description
-- looks like guidance content (longer, has markdown, has images, etc.)
-- 
-- Since we can't reliably distinguish "real description" from "guidance",
-- the safest approach is:
--   UPDATE adventure_routes SET guidance = description WHERE guidance IS NULL;
-- This ensures no data loss. Teachers can then edit/remove as needed.
UPDATE public.adventure_routes
SET guidance = description
WHERE guidance IS NULL AND description IS NOT NULL AND description != '';

-- Step 3: Do NOT clear description yet -- let the app manage that.
-- Teachers will see the existing description text on the card and can
-- decide whether to keep it, edit it, or clear it.
--
-- Future addToRoute() will set description = '' separately.
```

### 3.3 Store Operations (useAppStore.ts)

**`addAdventureStage`** (revised):
```typescript
addAdventureStage: (stage) => {
  const now = Date.now();
  set((state) => ({
    adventureStages: orderAdventureStages([
      ...state.adventureStages,
      {
        id: stage.id,
        title: stage.title,
        description: stage.description || '',     // card display text, explicitly set
        guidance: stage.guidance || '',            // ← NEW: learning guidance
        levelNum: stage.levelNum ?? state.adventureStages.length + 1,
        sourceStageId: stage.sourceStageId,
        sourceModule: stage.sourceModule,
        questionCount: stage.questionCount,
        unlockRule: 'previous_clear',
        source: stage.source || 'manual',
        createdAt: stage.createdAt || now,
        updatedAt: now,
      },
    ]),
  }));
}
```

**`updateAdventureStage`** (no change needed -- it already uses Partial<Omit<AdventureStage, 'id'>>, which will include `guidance`):
```typescript
updateAdventureStage: (id, patch) => {
  // patch can include { title, description, guidance, ... }
  // No changes needed -- the existing spread operator handles everything
}
```

**`getAdventureStages`** (revised -- add guidance resolution):
```typescript
getAdventureStages: () => {
  const state = get();
  if (state.adventureStages.length === 0) return [];
  return orderAdventureStages(state.adventureStages).map((stage, idx) => {
    const sourceStage = state.customStages.find(cs => cs.id === stage.sourceStageId);
    if (!sourceStage) {
      return {
        id: stage.id,
        module: 'adventure',
        stageNum: idx + 1,
        title: stage.title,
        description: stage.description,
        guidance: stage.guidance,       // ← NEW
        slices: [],
        questionCount: 0,
      };
    }
    const slices = sourceStage.sliceIds
      .map(sid => state.slicesPool.find(s => s.id === sid))
      .filter(Boolean) as Slice[];
    const qc = stage.questionCount || sourceStage.questionCount || sourceStage.sliceIds.length || slices.length;
    return {
      id: stage.id,
      module: 'adventure',
      stageNum: idx + 1,
      title: stage.title || sourceStage.title,
      description: stage.description || '',                          // card text, NOT guidance
      guidance: stage.guidance || sourceStage.guidance || '',        // ← NEW: explicit guidance, fallback to source
      slices,
      questionCount: qc,
    };
  });
}
```

### 3.4 SupabaseStorageProvider Changes

**Save** (add guidance to adventure_routes insert):
```typescript
const rows = stages.map((s) => ({
  route_name: 'main',
  stage_order: s.levelNum,
  title: s.title,
  description: s.description || null,
  guidance: s.guidance || null,        // ← NEW
  source_stage_id: s.sourceStageId,
  source_module: s.sourceModule,
  question_count: s.questionCount,
  unlock_rule: s.unlockRule,
  source: s.source || 'manual',
  updated_at: new Date().toISOString(),
}));
```

**Load** (read guidance from adventure_routes):
```typescript
adventureStages = (routeRows as any[]).map((r) => ({
  id: `adventure_route_${r.source_stage_id}_${...}`,
  title: r.title,
  description: r.description || undefined,
  guidance: r.guidance || undefined,       // ← NEW
  levelNum: r.stage_order,
  sourceStageId: r.source_stage_id,
  ...
}));
```

### 3.5 AdventureEditor UI Changes

**Edit Modal (replacing inline EditableFields)**

Replace the current inline `EditableFields` component with a full modal containing three sections:

1. **Title** (text input) -- already exists
2. **Description** (textarea) -- already exists, re-purpose as card description only
3. **Learning Guidance** (Markdown textarea + image upload) -- NEW, ported from CustomStageEditor

The modal should be a **centered modal overlay** (not side panel), matching the existing pattern in CustomStageEditor. Here's the proposed layout:

```
┌──────────────────────────────────────────────────┐
│  ✏️ 编辑关卡: 关卡名称              [×] close     │
├──────────────────────────────────────────────────┤
│                                                   │
│  关卡标题                                          │
│  ┌──────────────────────────────────────────────┐ │
│  │ [text input]                                 │ │
│  └──────────────────────────────────────────────┘ │
│                                                   │
│  关卡说明 (卡片上显示的文字)                         │
│  ┌──────────────────────────────────────────────┐ │
│  │ [textarea - 2 rows]                          │ │
│  └──────────────────────────────────────────────┘ │
│                                                   │
│  学习指导 (可选，支持 Markdown)                     │
│  ┌──────────────────────────────────── [📷 图片] ┐ │
│  │ [textarea - 5 rows]                          │ │
│  │ 支持粘贴/拖拽图片自动上传                      │ │
│  └──────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────┐ │
│  │ 👁 预览 (collapsible)                         │ │
│  │  [rendered Markdown with images]             │ │
│  └──────────────────────────────────────────────┘ │
│                                                   │
│           [取消]          [保存修改]               │
└──────────────────────────────────────────────────┘
```

**Image upload behavior** (reuse from CustomStageEditor, factored into shared component):
- File picker button: "📷 插入图片"
- Drag-and-drop onto the textarea
- Paste from clipboard (Ctrl+V / Cmd+V)
- During upload: show loading indicator with filename
- On success: insert `![alt](url)` at cursor position
- On failure: show error toast (4s auto-dismiss)

**Modal open trigger:** The existing Pencil icon edit button on each official route stage should open this modal instead of showing inline `EditableFields`.

**Component extraction recommendation:**
Extract the guidance editor (textarea + image upload + preview) into a shared component:
- `src/components/GuidanceEditor.tsx`
- Both `CustomStageEditor.tsx` and `AdventureEditor.tsx` import it
- Reduces code duplication significantly (~80 lines of guidance UI in CustomStageEditor)

### 3.6 `addToRoute()` Changes in AdventureEditor

```typescript
const addToRoute = (source: typeof customStages[number]) => {
  const existingCount = orderedRoute.filter(s => s.sourceStageId === source.id).length;
  addAdventureStage({
    id: `adventure_route_${source.id}_${existingCount + 1}`,
    title: source.title,
    description: '',                    // ← CHANGED: was source.guidance || '', now explicitly empty
    guidance: source.guidance || '',    // ← NEW: carry over source guidance as starting point
    sourceStageId: source.id,
    sourceModule: source.module,
    questionCount: source.questionCount || source.sliceIds.length || 1,
    unlockRule: 'previous_clear',
    source: 'manual',
  } as const);
  showMsg('已加入正式主线。');
};
```

### 3.7 Student-Side Display Logic (InteractiveQuiz.tsx)

**Current bug** (lines 242-248):
```typescript
const customStages = useAppStore(state => state.customStages);
const stageRecord = customStages.find(cs => cs.id === stageId);
const guidance = stageRecord?.guidance?.trim() ?? '';
```
This always returns empty for adventure stages.

**Fix** -- use `getAdventureStages()` for adventure route stages:
```typescript
const customStages = useAppStore(state => state.customStages);
const adventureStages = useAppStore(state => state.getAdventureStages());

let guidance = '';
if (stageId?.startsWith('adventure_route_')) {
  // Look up adventure stage's guidance (resolved fallback chain)
  const adventureStage = adventureStages.find(s => s.id === stageId);
  guidance = adventureStage?.guidance?.trim() ?? '';
} else {
  // Custom/auto stage: look up guidance from custom stage
  const stageRecord = customStages.find(cs => cs.id === stageId);
  guidance = stageRecord?.guidance?.trim() ?? '';
}
```

Note: This relies on `getAdventureStages()` exposing guidance. Since we added `guidance` to the `AutoStage` returned by `getAdventureStages()`, the adventure stage lookup works.

**Suppression logic considerations** (current "不再提示此关卡" behavior):
- Currently keyed by `stageId + guidance content hash` in localStorage
- For adventure stages, the suppression key is `adventure_route_xxx` -- this already works
- When guidance content changes (teacher edits), the hash changes, and the modal re-shows
- No changes needed to suppression logic

---

## 4. UX Decision: Description vs. Guidance Semantics

### Current ambiguity
The `description` field on `AdventureStage` currently stores both:
- "关卡说明" -- e.g., "这一关主要练习升降号识别"
- "学习指导" -- e.g., 50-line Markdown with images and music theory explanations

### Recommendation: Keep them separate

| Field | Purpose | Where shown | Typical content |
|-------|---------|-------------|-----------------|
| `description` | Card display text | Adventure stage card in CMS + student UI | Short, 1-2 sentences |
| `guidance` | Learning guidance | Modal before quiz starts | Markdown, images, music theory explanations |

**Migration strategy for existing data:**
- In the SQL migration, copy `description → guidance` for all existing rows
- After migration, the description will continue to show on stage cards in the student UI
- Teachers should manually split the content:
  - Short display text stays in `description`
  - Full guidance stays in `guidance`
  - If they were the same text, just clear `description`

**Backwards compatibility in code:**
- If `guidance` is empty for an existing adventure stage (e.g., published before this change), fall back to `description` for the guidance modal
- This ensures no student ever encounters a blank guidance modal after migration

```typescript
// In getAdventureStages():
guidance: stage.guidance || sourceStage.guidance || stage.description || '',
```

This triple fallback ensures:
1. Explicit adventure stage guidance (new data)
2. Source custom stage guidance (if adventure stage hasn't set its own)
3. Adventure stage description (backwards compat with old data where description = guidance)
4. Empty string (nothing available)

---

## 5. Image Upload Component Reuse

### Current state
In `CustomStageEditor.tsx` (lines 244-331), the guidance UI includes:
- Textarea with `ref={textareaRef}` for cursor position insertion
- `insertAtCursor()` helper function
- `runUpload()` / `runUploads()` async file handling
- Paste event handler (`onPaste`)
- Drag-and-drop event handlers (`onDragOver`, `onDrop`)
- File input with picker button
- Upload status display (idle/uploading/error)
- Markdown preview section (collapsible `<details>`)

### Recommendation: Extract shared `GuidanceEditor` component

New file: `src/components/GuidanceEditor.tsx`

Props interface:
```typescript
interface GuidanceEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}
```

This component encapsulates:
- The textarea with ref
- The upload logic (calling `uploadGuidanceImage()`)
- The paste/drag-drop handlers
- The file picker button
- The upload status display
- The Markdown preview (ReactMarkdown with remarkGfm, remarkBreaks, custom img/a components)

Both `CustomStageEditor.tsx` and `AdventureEditor.tsx` would then use:
```tsx
<GuidanceEditor
  value={guidance}
  onChange={setGuidance}
  placeholder={'例如：\n这一关主要练习升降号识别。\n\n（直接拖拽或粘贴图片即可上传）'}
/>
```

---

## 6. File Change Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/core/store/useAppStore.ts` | Modify | Add `guidance` to `AdventureStage`, add `guidance` to `AutoStage`, update `getAdventureStages()`, update `addAdventureStage()` |
| `src/core/storage/SupabaseStorageProvider.ts` | Modify | Add `guidance` to adventure_routes save/load |
| `src/core/storage/syncOps.ts` | No change | Adventure stages are synced via full publish, not incremental syncOps |
| `src/pages/cms/AdventureEditor.tsx` | Major change | Replace inline `EditableFields` with modal, add guidance editor + image upload, update `addToRoute()` |
| `src/pages/cms/CustomStageEditor.tsx` | Refactor | Use shared `GuidanceEditor` component (reduces duplication) |
| `src/components/GuidanceEditor.tsx` | **NEW** | Shared guidance textarea + image upload + preview component |
| `src/components/GuidanceModal.tsx` | No change | Already works correctly for any guidance string |
| `src/pages/client/InteractiveQuiz.tsx` | Modify | Fix guidance lookup for adventure stages |
| `docs/data/migrate-adventure-guidance.sql` | **NEW** | SQL migration to add `guidance` column |

---

## 7. Migration Sequence (Implementation Order)

### Phase 1: Foundation
1. Create shared `GuidanceEditor` component (extract from CustomStageEditor)
2. Add `guidance` to `AdventureStage` and `AutoStage` interfaces
3. Update store operations (`addAdventureStage`, `getAdventureStages`)
4. Update `SupabaseStorageProvider` to persist/load `guidance`

### Phase 2: AdventureEditor
5. Replace inline `EditableFields` with modal
6. Add guidance editor + image upload to the modal
7. Update `addToRoute()` to properly split description and guidance

### Phase 3: Student Display
8. Fix `InteractiveQuiz` guidance lookup for adventure stages
9. Add backwards-compat fallback to `stage.description` for old data

### Phase 4: Database
10. Write and run SQL migration
11. Test with existing published data

### Phase 5: Cleanup
12. Refactor `CustomStageEditor` to use shared `GuidanceEditor`

---

## 8. Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Existing published adventure routes lose guidance display | Medium | Fallback chain: `guidance → sourceStage.guidance → stage.description` ensures old data still renders |
| `description` field displays garbage text on cards after migration | Low | `description` already contained guidance text; this was already showing on cards. Migration just makes it explicit. |
| SQL migration fails on existing deployment | Low | `ADD COLUMN IF NOT EXISTS` is idempotent; the UPDATE is a simple bulk operation |
| Image upload bucket access changes needed | None | Same Supabase Storage bucket `stage-guidance-images` is reused |
| Student-side suppression cache breaks with new field | None | Suppression keyed by `stageId + guidance content hash`; changing field source but same content = same hash |

---

## 9. Open Questions

1. **Should the guidance fallback chain include `sourceStage.guidance`?** 
   - Yes -- this ensures that when a teacher adds a custom stage to an adventure route but hasn't customized the guidance yet, the student still sees the original guidance written by the teacher in CustomStageEditor.
   - Downside: if a teacher edits guidance in the custom stage, it silently changes guidance shown in the adventure route. This is actually desirable behavior (source of truth).

2. **What happens to the existing `description` content in published routes after migration?**
   - The SQL migration copies it to `guidance`. It stays in `description` too. When the teacher next opens the edit modal in AdventureEditor, they'll see both fields and can clean up.

3. **Should the guidance editor be a full-screen modal or a centered modal?**
   - Centered modal (matching CustomStageEditor's edit pattern). The edit modal should be wide enough (640px+) to comfortably display the Markdown preview alongside editing.

4. **Is there ever a case where guidance is needed but the source custom stage doesn't have it?**
   - Yes -- teachers may want to add guidance specifically for the adventure route context. The guidance editor allows this independently of the custom stage.

5. **Should we also migrate the existing `docs/data/data.json`?**
   - This appears to be a development artifact (untracked per git status). It does not need migration if it's regenerated from the database.

---

## 10. Key Design Decisions (Summary)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data model | Add `guidance` field (Option A) | Cleanest split, simplest mental model, minimal schema change |
| Edit UX | Centered modal (not inline, not side panel) | Matches existing CMS patterns; can hold all fields comfortably |
| Component reuse | Extract `GuidanceEditor` | ~80 lines of duplicated code; avoids copy-paste bugs |
| Image upload | Reuse existing Supabase `stage-guidance-images` bucket | Already proven; no infrastructure changes |
| Guidance resolution | `stage.guidance || sourceStage.guidance || stage.description || ''` | Max backwards compat |
| Description semantics | Card display text ONLY | Clean semantic boundary; teachers explicitly set it |
