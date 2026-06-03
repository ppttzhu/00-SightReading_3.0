# Devil's Advocate: "学习指导" Storage & Editing Refactoring

## Overview

This document critiques the proposed refactoring that moves "学习指导" (learning guidance) editing from `CustomStageEditor` to `AdventureEditor`, introduces a semantic split between `description` and `guidance`, starts both fields empty when adding stages to a route, and "optimizes" guidance storage.

---

## 1. "Start Empty": A Workflow Regression Disguised as Cleanliness

### The Current Behavior

```typescript
// AdventureEditor.tsx:156
addAdventureStage({
  ...
  description: source.guidance || '',  // auto-copies from source
  ...
});

// getAdventureStages() fallback
description: stage.description || sourceStage.guidance,  // second-chance fallback
```

Two layers of auto-copy guarantee guidance always propagates. For any stage with existing guidance (which is every stage where a teacher bothered to write it), the student sees it.

### The Proposed Behavior

`description = ''`, `guidance = ''` — completely blank start.

**The friction math**: A teacher with a 15-stage route must:
1. Click each of 15 stages to open the edit panel
2. Write/rewrite guidance for each (or copy-paste from the source stage)
3. This is 15 modal operations vs. the current 0

**The risk calculus**: Teachers are busy. The single largest predictor of feature adoption in CMS tools is "does it work by default." If every stage starts empty, the likely outcomes are:
- Teachers write guidance for the first 3 stages, then get bored
- Teachers skip guidance entirely for most stages
- Only the most diligent 20% of teachers fill all 15

**Contrast with current**: Because guidance auto-copies, even a lazy teacher gives every student guidance for every stage. The proposed change makes guidance a "premium feature" only the most motivated teachers will fully populate.

### The Flagpole Fallacy

Proponents will say: "But adventure stages can have DIFFERENT guidance than the source stage — auto-copy creates confusion!"

This is a straw man. The correct solution is:
```
addToRoute: description = '', guidance = COPY_FROM_SOURCE
```
Then let the teacher EDIT from a filled-in baseline. This:
- Preserves the "guidance exists by default" property
- Gives the teacher a starting point to customize
- Is strictly less work than starting from blank

Starting from blank is ideological purity at the expense of the 80% use case.

---

## 2. Storage Optimization: What Problem Exactly Are We Solving?

### The Current Storage

```
adventure_routes.description TEXT   -- currently holds guidance content
stages.guidance            TEXT   -- holds custom-stage guidance

Both: Markdown text with `![alt](url)` image embeddings.
```

The user thinks this "needs improvement." Let's examine concrete claims.

### Claim: "Images are stored as URLs in TEXT — we lose query-ability"

**Counterpoint**: Querying guidance content for images is a non-use-case. When would you ever run:
```sql
SELECT * FROM adventure_routes WHERE description LIKE '%![%';
```
Answer: Never. You render guidance as Markdown. You don't SQL-query rendered HTML.

### Claim: "We need structured storage for image references"

**Counterpoint**: Structured storage (a separate `guidance_images` table with FK to stage) solves exactly one problem: orphan detection. But orphan detection is already not done — and won't be done — because:
- The `guidanceImageUpload.ts` comment at line 31 explicitly says: *"Image objects are NOT cleaned up when guidance text is deleted — leaving orphan cleanup as a follow-up admin tool."*
- Adding a `guidance_images` table does nothing without a background job or admin panel that actually cleans up orphans. Without that, it's just more schema to maintain.

### Claim: "TEXT columns have size limits"

**Counterpoint**: Postgres TEXT is ~1 GB. Even the most verbose guidance with 50 embedded images at 150 characters per URL is ~7.5 KB. We are using 0.00075% of the available space.

### Claim: "Markdown in TEXT is hard to migrate"

**Counterpoint**: Moving a TEXT column from one table to another is a single ALTER TABLE or INSERT...SELECT. If we add a `guidance` column to `adventure_routes`, the migration is:
```sql
ALTER TABLE adventure_routes ADD COLUMN guidance TEXT;
UPDATE adventure_routes SET guidance = description WHERE description IS NOT NULL AND description != '';
```
That's it. TEXT-to-TEXT migration is trivial. There is no "optimization" needed.

### Verdict

The current TEXT + embedded markdown approach has zero concrete problems in production. "Optimizing" it before any performance issue, data corruption, or query bottleneck has been observed is premature engineering. The risk is spending engineering cycles to replace something that works with something that also works — but costs more to maintain.

**If orphan cleanup is the real problem, solve orphans directly** (a Supabase Edge Function or admin panel button that parses all guidance text, extracts URLs, and deletes unreferenced objects). Don't restructure storage to enable a solution you're not building.

---

## 3. Loss of CustomStageEditor Guidance: The Silent Regression

### What Gets Removed

`CustomStageEditor.tsx` lines 244-331 contain a full-featured guidance editor:
- Live Markdown preview with `ReactMarkdown` rendering
- Image file picker button
- Drag-and-drop image upload
- Paste image upload
- Cursor-position-aware `![alt](url)` insertion
- Upload status feedback (progress + error states)

### The Unasked Question: What About Non-Adventure Practice?

Students access stages through TWO paths:
1. **Adventure mode**: Route-based, map UI -> `getAdventureStages()`
2. **Module-based practice**: Direct stage access via `getAllStages(moduleId)` -> `InteractiveQuiz`

Path 2 uses stages directly from `customStages` and relies on `cs.guidance`. If guidance editing is removed from `CustomStageEditor`:
- Teachers can no longer create guidance for new custom stages
- Existing custom stage guidance becomes frozen (no edits)
- Teachers must add every guided stage to an adventure route, even for module-based practice

**The impact**: A teacher who wants to create a "Symbols Practice Pack" with 5 custom stages and guidance for each now must:
1. Create 5 stages in CustomStageEditor (no guidance)
2. Go to AdventureEditor
3. Add all 5 to a route
4. Write guidance for all 5

This is double the work for what was previously a single-editor operation.

### The Live Preview

The existing guidance editor has a collapsible Markdown preview (`<details>` element at line 313). This is crucial for teachers writing Markdown — they need to see how images render, whether headings work, etc. The proposed AdventureEditor guidance must replicate this feature, or teachers will be writing Markdown blind.

---

## 4. Orphan Image Proliferation: Worse, Not Better

### Current State

- `stage-guidance-images` bucket, random UUID naming
- Images referenced only via markdown URLs in TEXT columns
- Zero cleanup (explicitly acknowledged as "follow-up" in code comments)
- Orphans accumulate every time a teacher deletes an `![alt](url)` from guidance but doesn't delete the Supabase Storage object

### How It Gets Worse

Adding a second editing surface (AdventureEditor) where teachers can upload images means:
- Images are still uploaded to the same bucket with the same random naming
- Still no reference tracking
- Now from TWO sources instead of one
- If a teacher experiments with guidance in AdventureEditor, then removes the stage from the route — the images remain in the bucket forever
- If a teacher writes guidance, publishes, then edits and replaces images — both old and new images persist

### The Only Real Fix

A storage "optimization" that doesn't solve orphan cleanup is not an optimization. The only meaningful improvement is:
1. Parse all guidance/description TEXT across all stages
2. Extract all `https://*.supabase.co/storage/v1/object/public/stage-guidance-images/*` URLs
3. List all objects in the bucket
4. Delete objects whose URLs don't appear in any field

This can be done as a Supabase Edge Function or a one-off admin script. It does not require schema changes.

---

## 5. Data Migration: Fragile and Incomplete

### The Schema Gap

Currently:
- `adventure_routes` has a `description TEXT` column
- `AdventureStage` interface has `description?: string` but NO `guidance` field
- `getAdventureStages()` uses `stage.description` as both card text AND (via fallback) guidance display

To split semantics, you need:
```sql
ALTER TABLE adventure_routes ADD COLUMN guidance TEXT;
```
AND:
```typescript
// AdventureStage interface needs:
interface AdventureStage {
  ...
  description?: string;  // card display text
  guidance?: string;     // learning content (new)
}
```

### The Migration Question

What happens to existing `description` values in `adventure_routes`?

**Scenario A**: Assume existing descriptions ARE guidance content. Then:
```sql
UPDATE adventure_routes SET guidance = description;
-- But description gets set to '' or NULL
-- Result: all existing adventure stages lose card display text
```

**Scenario B**: Assume existing descriptions ARE card text. Then:
```sql
-- guidance starts NULL everywhere
-- Result: existing stages keep card text but lose guidance
-- Students who had guidance before now get nothing
```

**Scenario C**: Hybrid — some descriptions contain guidance, some contain card text. There is no way to distinguish them programmatically. The semantic split was never enforced before, so existing data is a mixed bag.

**The real answer**: Someone must manually audit every existing `adventure_routes` row and decide which semantic bucket each `description` belongs to. For a CMS with 50+ stages, this is a manual data-entry task that will likely never be done.

### What About `stages.guidance`?

The `stages` table already has a `guidance` column. If guidance editing moves to AdventureEditor:
- Do we deprecate the column? (schema debt)
- Do we keep it for backward compatibility? (confusion: "two guidance fields")
- When loading from remote, do we merge `stages.guidance` into adventure stage guidance? (complex migration logic)

---

## 6. Sync Concerns: Guidance Edits Require Full Publish

### Current Sync Architecture

| Data Type | Sync Mechanism | Latency |
|-----------|---------------|---------|
| CustomStage | `syncUpsertStage()` — incremental, near-instant | ~1-2s |
| AdventureStage | Full publish (`save()` in SupabaseStorageProvider) | ~2-5s + user-initiated |

### The Problem

Under the proposed design, when a teacher edits guidance in AdventureEditor:
1. They make the edit -> local Zustand state updates (instant)
2. The guidance does NOT sync to Supabase
3. Only when they click "发布路线" (Publish) does `save()` run and write `adventure_routes` rows
4. If a teacher edits guidance but forgets to publish -> guidance exists only locally

At minimum, the publish button should show a visual indicator when unsaved guidance changes exist. Currently `hasUnpublishedChanges` is a crude `orderedRoute.length > 0` check that doesn't track dirty state.

### Contrast With CustomStage Sync

```typescript
// CustomStage: sync happens on every updateCustomStage()
updateCustomStage: (id, patch) => {
  set(...);
  const updated = get().customStages.find(cs => cs.id === id);
  if (updated) void syncUpsertStage(updated, sortIndex); // <-- auto-sync
}
```

Teachers are accustomed to "edit -> auto-save." Removing that expectation for guidance is a UX regression. The teacher who edits guidance and navigates away will lose their work if they don't remember to publish.

---

## 7. The Student-Side Bug: Independent of This Refactoring

### The Bug

`InteractiveQuiz.tsx` line 243:
```typescript
const stageRecord = customStages.find(cs => cs.id === stageId);
```

For adventure stages where `stageId` is `adventure_route_<uuid>`, this lookup ALWAYS returns `undefined`. The guidance modal is NEVER shown for adventure stages.

This bug exists RIGHT NOW, regardless of any storage optimization. It must be fixed regardless.

### The Fix

```typescript
const stageRecord = stageId?.startsWith('adventure_route_')
  ? /* look up by getAdventureStages() */  
  : customStages.find(cs => cs.id === stageId);
```

Or, if `guidance` is added to `AdventureStage`/`AutoStage`:

```typescript
const guidance = stageId?.startsWith('adventure_route_')
  ? (useAppStore.getState().getAdventureStages().find(s => s.id === stageId)?.guidance ?? '')
  : (customStages.find(cs => cs.id === stageId)?.guidance ?? '');
```

### The Danger

The proposed refactoring adds MORE surface area for bugs in this same code path:
- If guidance moves to AdventureStage, the non-adventure path still reads `customStages`
- If guidance is removed from CustomStage, the non-adventure path breaks entirely
- The `stageRecord` variable is used at line 574 for the modal title: `title={stageRecord.title}` — if stageRecord is undefined, this crashes

**The refactoring must fix this bug, not introduce new related bugs.**

---

## 8. Hidden Schema Dependencies

### What Must Change (Minimum)

| File | Change Required | Risk |
|------|----------------|------|
| `useAppStore.ts` | Add `guidance` field to `AdventureStage` | Interface change affects all consumers |
| `useAppStore.ts` | Add `guidance` field to `AutoStage` | Returned by `getAdventureStages()` |
| `useAppStore.ts` | Add `getAdventureStages()` return `guidance` | Must propagate from AdventureStage.guidance |
| `AdventureEditor.tsx` | Add guidance editor UI (file picker, drag-drop, paste, preview) | Re-implementing existing CustomStageEditor functionality |
| `CustomStageEditor.tsx` | Remove guidance section | Loss of guidance for non-adventure stages |
| `InteractiveQuiz.tsx` | Fix guidance lookup for adventure stages | Must handle BOTH paths |
| `SupabaseStorageProvider.ts` | Read/write `guidance` column in `adventure_routes` | Schema migration required |
| `migration_add_adventure_paths.sql` | Already deployed — needs new migration to add `guidance` column | Production migration needed |
| `syncOps.ts` | No change (adventure stages not in incremental sync) | Gap: guidance edits not synced until publish |

### The "Minimum Viable Migration" Is Still Complex

Even the simplest version (add guidance column, add field to interface, wire up editor) touches 6+ files and requires a database migration. For a feature that currently works (guidance exists, displays for students, supports Markdown + images), this is significant risk for uncertain gain.

---

## 9. Alternative: The Minimal Fix

If the goal is "enable guidance for adventure stages," the minimal change is:

1. **Keep guidance in CustomStage** (don't remove from CustomStageEditor)
2. **Add guidance to AdventureStage** (new column, new interface field)
3. **Add guidance editor to AdventureEditor** (reuse the same `uploadGuidanceImage` pattern)
4. **Fix the student-side bug** (proper lookup for adventure stages)
5. **addToRoute: COPY guidance from source** (preserve the "works by default" property)
6. **Don't "optimize" storage** (no schema changes beyond a single column add)
7. **Defer orphan cleanup** to a dedicated tool (as already planned)

This addresses every real problem without:
- Breaking existing workflows
- Removing functionality from CustomStageEditor
- Forcing teachers into more clicks
- Requiring a data migration that can't be cleanly automated

---

## Summary Table

| Concern | Severity | Can Be Mitigated? | Mitigation Cost |
|---------|----------|-------------------|-----------------|
| Start empty -> guidance skipped | High | Partially (copy from source) | Low |
| Storage optimization solves nothing | Medium | Drop it; focus on real problems | Zero (don't do it) |
| Non-adventure stages lose guidance | High | Keep guidance in CustomStage | Low |
| Orphan images unchanged | Medium | Build cleanup tool independently | Medium |
| Data migration ambiguity | High | Manual audit of existing rows | Very high |
| Full-publish sync requirement | Medium | Add dirty-state tracking; auto-publish guidance | Medium |
| Student-side bug NOT fixed by refactor | High | Fix it anyway (independent change) | Low |
| 6+ files touched, DB migration needed | Medium | Scope reduction | Low |

**Recommendation**: Separate this into two independent changes:
1. **Must-do**: Fix the student-side guidance lookup bug + Add guidance field to adventure stages + Add guidance editor to AdventureEditor (keep CustomStageEditor guidance too)
2. **Debatable**: "Start empty" behavior + Storage optimization — neither provides concrete user-facing benefit and both increase teacher friction
