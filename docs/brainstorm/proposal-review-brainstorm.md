# Proposal Review: refactor-adventure-guidance

## Reviewer
Senior software architect review, based on thorough reading of all proposal files, existing specs, and the current codebase implementation.

---

## 1. Completeness

### 1.1 Missing: Incremental sync identity problem for `syncUpsertAdventureStage()`

**Severity: High**

The proposal introduces `syncUpsertAdventureStage()` for incremental sync when a teacher edits guidance and clicks "save". However, the current `SupabaseStorageProvider.save()` for `adventure_routes` uses a **delete-all-and-reinsert** pattern:

```typescript
// SupabaseStorageProvider.ts lines 227-251
const { error: delErr } = await client
  .from('adventure_routes')
  .delete()
  .eq('route_name', 'main');
// ... then re-insert all rows
```

This means the DB row's primary key (`id`) changes on every publish. The new `syncUpsertAdventureStage()` function would need a stable upsert key to identify which row to update. The proposal does not address this.

**Recommendation**: Add a `stage_id` column with a UNIQUE constraint to `adventure_routes` that matches the local ID format (`adventure_route_${sourceStageId}_${index}`), then upsert on `ON CONFLICT (stage_id) DO UPDATE`. Alternatively, use a stable UUID column. Document this in the migration tasks.

### 1.2 Missing: `loadFromRemote` guidance and description fix in `getAdventureStages()`

**Severity: High**

The current `getAdventureStages()` at line 303 of `useAppStore.ts` has a semantic conflation:

```typescript
description: stage.description || sourceStage.guidance,
```

This falls back to `sourceStage.guidance` when `stage.description` is empty, which is the exact dual-purpose bug the proposal aims to fix. After the proposal:

- `description` should be purely the card description: `stage.description || ''`
- `guidance` should use the new fallback chain: `stage.guidance ?? sourceStage.guidance ?? ''`

The `adventure-path` spec delta only adds guidance/guidanceImages to the AutoStage return but does **not** explicitly call out fixing the `description` mapping. This is a gap — if left unchanged, guidance content would still leak into the card description for old stages.

**Recommendation**: Add an explicit requirement/scenario to the `adventure-path` spec: the `description` field in `getAdventureStages()` return MUST NOT fall back to `sourceStage.guidance`. It should be `stage.description || ''`.

### 1.3 The guidance fallback chain uses `||` instead of `??`

**Severity: Medium**

The spec says the fallback chain is:
```
stage.guidance || sourceStage.guidance || stage.description || ''
```

Using `||` means that if a teacher explicitly sets guidance to an empty string (clearing it), the fallback will still show `sourceStage.guidance` or `stage.description`. This defeats the teacher's intent. After migration, `stage.description` also contains the old guidance content, making the leak even worse.

**Recommendation**: Use `stage.guidance ?? sourceStage.guidance ?? ''`. The `??` operator respects empty string as a deliberate value and only falls back on `null`/`undefined`. Also remove `stage.description` from the guidance fallback chain entirely — that's a different field now.

### 1.4 Missing: `AutoStage` interface extension not in spec, only in tasks

**Severity: Medium**

Task 2.3 says add `guidance`/`guidanceImages` to `AutoStage`, and the proposal "What Changes" section mentions it. But the `adventure-path` spec only describes the behavior of `getAdventureStages()` returning guidance — it does not explicitly state that the `AutoStage` interface gains new fields. Since `AutoStage` is used in `InteractiveQuiz.tsx` as the `stage` type, this needs to be a spec-level requirement.

### 1.5 Missing: Image deletion contradiction between design.md and stage-guidance spec

**Severity: High**

The `design.md` Risk Table says:

> 图片表与 Storage 不一致 | Low | 上传时双写（Storage + DB）；删除时双删

This implies both DB and Storage are cleaned on deletion. But the `stage-guidance` spec Scenario says:

> 不自动删除 Supabase Storage 中的文件（保留孤儿清理给后续 admin 工具）

These are **directly contradictory**. The spec is more detailed and likely represents the intended behavior (no Storage deletion), but the risk table needs to be updated to match.

---

## 2. Correctness

### 2.1 GuidanceModal uses `stageRecord` which is always `null` for adventure stages

**Severity: Critical** — this is the exact bug being fixed

Current `InteractiveQuiz.tsx` lines 242-248:

```typescript
const customStages = useAppStore(state => state.customStages);
const stageRecord = customStages.find(cs => cs.id === stageId);
const guidance = stageRecord?.guidance?.trim() ?? '';
const [introDismissed, setIntroDismissed] = useState(() => {
  if (!stageId || !guidance) return true;
  return readSuppressedMap()[stageId] === guidance;
});
```

And line 574:

```typescript
if (!introDismissed && guidance && stageRecord) {
  return (
    <GuidanceModal
      title={stageRecord.title}
      guidance={guidance}
      ...
    />
  );
}
```

For adventure stages (`adventure_route_xxx`):
- `stageRecord` is always `null` (`customStages` never has such IDs)
- `guidance` is always `''`
- `introDismissed` is always `true`
- The condition `!introDismissed && guidance && stageRecord` is always false
- **GuidanceModal never shows for adventure stages**

The proposal's task 7.1/7.3 correctly identifies that guidance lookup needs fixing. However:

- The `stageRecord` variable is also used for `title` in the modal. After fixing, the code needs to use `stage.title` from the `useMemo` result.
- The condition `stageRecord` at line 574 becomes stale — it should check for the resolved `stage` (AutoStage) instead.
- The proposal's `quiz-practice` spec mentions resolving from `AutoStage` but doesn't explicitly address that `stageRecord` is the variable gating the entire modal and title source.

**Recommendation**: The tasks should explicitly list modifying the guidance modal trigger to use the `stage` (AutoStage) object from `useMemo` rather than `stageRecord` from `customStages.find()`. The guidance conditional should become:
```typescript
const guidance = stage?.guidance?.trim() ?? '';
```

### 2.2 `addToRoute()` currently sets `description: source.guidance` — proposal correctly changes this

Line 156 of `AdventureEditor.tsx`:
```typescript
description: source.guidance || '',
```

The proposal (Decision 4) correctly changes this to `description: ''`. However, there's a transitional issue: when the migration runs (`UPDATE adventure_routes SET guidance = description WHERE guidance IS NULL`), old routes will have `guidance = description` but `description` column still has the old dual-purpose content. When loading old data, the `SupabaseStorageProvider.load()` should map both `guidance` and `description` independently from the DB columns — which the proposal's task 3.2 addresses.

But: the current `load()` code (line 315-329) already maps `description` from the DB column. It just needs to also read `guidance` from the DB. This is fine as long as load maps them independently.

### 2.3 `guidanceImageUpload.ts` currently inserts `![alt](url)` — needs to change to `{image:id}`

**Severity: Medium**

The current `CustomStageEditor.tsx` at line 94 inserts markdown images directly:
```typescript
insertAtCursor(`![${alt}](${url})`);
```

The proposal changes the format to `{image:id}` placeholders. However, task 4.3 says to insert `{image:id}` — but the `uploadGuidanceImage()` function currently only uploads to Storage and returns a URL. It doesn't write to the `adventure_guidance_images` table or return an ID. Task 4.10 says to modify it to write to the table, but the implementation of how the returned ID flows back to `runUpload()`/`insertAtCursor()` isn't fully specified.

**Recommendation**: Clarify the return type of `uploadGuidanceImage()` — it should return `{ id: string, url: string }` (or a `GuidanceImage` object) so the caller can insert `{image:id}` and also add the image metadata to the stage's `guidanceImages` array.

### 2.4 Old data in `stage.description` after migration

The migration SQL `UPDATE adventure_routes SET guidance = description WHERE guidance IS NULL` copies description to guidance but does **not** clear description. This means old adventure stages will have both `description` and `guidance` containing the same old content. Teachers viewing old stages in the editor will see the description field pre-filled with what was guidance content.

This is acknowledged in the design.md Risk Table ("教师可后续清理"), but there's no task in `tasks.md` for a migration step that either clears description or provides a "cleanup" tool. Consider adding a post-migration data cleanup step.

---

## 3. Clarity

### 3.1 `GuidanceModal` callback signature after removing "不再提示"

The current `GuidanceModal` props:
```typescript
interface Props {
  title: string;
  guidance: string;
  onStart: (dontShowAgain: boolean) => void;
}
```

After removing the checkbox:
- Should `onStart` become `onStart: () => void` (no parameter)?
- Should the component be renamed to `onDismiss`?
- The `quiz-practice` spec says "学生点击'开始答题'后关闭弹框进入答题" — this implies there's still a "start" button. But the exact new signature is not specified.

**Recommendation**: Add a clear statement in the `stage-guidance` spec about the new `GuidanceModal` interface.

### 3.2 "关卡列表显示'含指导'标签" in AdventureEditor needs clarification

Task 5.6 says AdventureEditor should show a guidance badge. The current `AdventureEditor.tsx` does NOT have such a badge for adventure stages — this is new. It's clear enough but should be consistent with whether the badge appears based on `stage.guidance` or on the resolved `getAdventureStages().guidance`.

### 3.3 Two separate SQL migration files — ordering and dependency

Tasks 1.1 and 1.2 create two SQL files, but the migration execution order and dependency between them is implicit:
- Task 1.1: `migration_add_adventure_routes_guidance.sql` (ALTER TABLE)
- Task 1.2: `migration_create_adventure_guidance_images.sql` (CREATE TABLE)

If these need to be run in order, document it. If they're independent, note that too.

---

## 4. Consistency

### 4.1 `adventure-path` spec only shows MODIFIED deltas, not the full new state

The spec folder only contains the delta (MODIFIED/ADDED/REMOVED sections). This is fine for a delta-based system, but the reader cannot see the complete final state of the `AdventureStage` interface requirements after the change. For example, it's unclear whether the original spec defined `description` as "卡片说明" or had it conflated.

This is more of a process observation than a bug; the implementation will need to read both the source spec and the delta.

### 4.2 `SupabaseStorageProvider.save()` needs guidance column in re-insert

The current `save()` method re-inserts `adventure_routes` rows with a fixed set of columns (line 236-246):
```typescript
const rows = stages.map((s) => ({
  route_name: 'main',
  stage_order: s.levelNum,
  title: s.title,
  description: s.description || null,
  source_stage_id: s.sourceStageId,
  // ... no guidance or guidance_images
}));
```

After the change, this must also include `guidance` and `guidance_images`. Task 3.1 covers this indirectly but might be missed since `save()` is not explicitly listed in the "affected files" section (only `syncOps.ts` is listed for sync changes).

### 4.3 `CustomStageEditor` test for guidance removal

The proposal removes guidance editing from `CustomStageEditor.tsx`. Any existing tests that interact with the guidance textarea/upload will break. The proposal doesn't mention updating or removing tests in `CustomStageEditor.test.tsx` or similar test files.

---

## 5. Edge Cases

### 5.1 Empty guidance after migration

If a teacher has never set guidance for a stage, after migration `guidance` will be `NULL`, `description` will still be empty. The `getAdventureStages()` fallback chain should produce `''`, which means no guidance modal shown. This is correct behavior.

### 5.2 Student enters a stage that was deleted from customStages but exists in adventureStages

The current `getAdventureStages()` handles this (line 283-293 of `useAppStore.ts`): it returns a stage with empty slices. The guidance would still be read from `stage.guidance` (the adventure stage's own copy). After the proposal, guidance is separated, so if the adventure stage has guidance set, it's still shown even if the source stage is deleted. This is actually more robust than the current implementation.

### 5.3 The `{image:id}` format and old markdown `![alt](url)` backward compatibility

The proposal's Decision 2 mentions backward compatibility — old `![alt](url)` format should still render because the URLs haven't changed. However, the rendering code in `GuidanceModal` (and in the new `GuidanceEditor` preview) needs to handle both formats:

1. Old format: `![alt](url)` — rendered by ReactMarkdown img component
2. New format: `{image:id}` — needs custom parsing in GuidanceModal

The `quiz-practice` spec mentions this ("Markdown 渲染支持 `{image:id}` 占位符解析") but doesn't specify how the two formats coexist in rendering. The new `{image:id}` format is not valid Markdown, so ReactMarkdown will render it as plain text (which is correct fallback). A custom preprocessor or `components` override would need to intercept `{image:id}` tokens and replace them with `<img>` tags.

**Recommendation**: Specify the rendering approach — either a string preprocessor before ReactMarkdown, or a custom `components.p` (paragraph) handler that detects inline `{image:id}` patterns.

### 5.4 Image deletion from `stage.guidanceImages` array

The `stage-guidance` spec says deleting an image from the image list should remove it from `adventure_guidance_images` (DB table) and from `stage.guidanceImages`. However, the current `updateAdventureStage()` action applies a `Partial<AdventureStage>` patch. Removing an image from an array within a partial patch is awkward — you would need to pass the full filtered array.

There is no dedicated `removeGuidanceImage()` action in the store. The proposal's tasks don't mention creating one. This means either:
- The component reads the current `guidanceImages`, filters it, and calls `updateAdventureStage(id, { guidanceImages: filtered })` with the full array.
- Or a new store action is added.

**Recommendation**: Add a task to either document the "read-filter-write" pattern or add a dedicated `removeAdventureStageImage(stageId, imageId)` action.

### 5.5 No tasks for GuidanceModal test changes

`GuidanceModal.test.tsx` exists. After removing the checkbox and suppression logic, the test file needs updating. The proposal doesn't mention this.

---

## Summary of Recommendations

| # | Area | Severity | Action |
|---|------|----------|--------|
| 1 | `syncUpsertAdventureStage()` identity | High | Add stable `stage_id` column with UNIQUE constraint to `adventure_routes` for upsert |
| 2 | `getAdventureStages()` description fallback | High | Fix to NOT fall back to `sourceStage.guidance` |
| 3 | Guidance fallback uses `\|\|` not `??` | Medium | Change to `stage.guidance ?? sourceStage.guidance ?? ''` |
| 4 | `AutoStage` interface extension in spec | Medium | Explicitly add `guidance`/`guidanceImages` to `AutoStage` in `adventure-path` spec |
| 5 | Image delete contradiction | High | Align design.md risk table with stage-guidance spec (no Storage delete) |
| 6 | `stageRecord` null for adventure stages | Critical | Ensure tasks fix the modal trigger to use AutoStage, not customStages.find() |
| 7 | `uploadGuidanceImage` return type | Medium | Clarify it returns `{ id, url }` for `{image:id}` format |
| 8 | Migration does not clear `description` | Low | Add optional cleanup step |
| 9 | `GuidanceModal` new interface undefined | Medium | Specify new callback signature in stage-guidance spec |
| 10 | `SupabaseStorageProvider.save()` needs guidance | Medium | Ensure guidance/guidance_images are included in re-insert rows |
| 11 | `{image:id}` rendering approach undefined | Medium | Specify preprocessor or component override approach |
| 12 | Image removal from `guidanceImages` array | Medium | Add dedicated action or document the pattern |
| 13 | Test file updates not mentioned | Low | Add tasks for GuidanceModal.test.tsx and CustomStageEditor.test.tsx updates |
