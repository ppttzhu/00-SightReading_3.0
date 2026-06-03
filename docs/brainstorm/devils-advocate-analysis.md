# Devil's Advocate Analysis: Moving Guidance & Image Upload to AdventureEditor

## Executive Summary

This analysis evaluates the proposal to move "学习指导" (learning guidance) editing and image upload capabilities from CustomStageEditor to AdventureEditor. The proposal aims to fix a known bug where guidance never shows for adventure stages in the student UI, and to give teachers the ability to author per-adventure-stage guidance. However, the proposal introduces significant data model ambiguity, migration complexity, and architectural consistency risks that must be addressed before implementation.

---

## 1. Data Model Risks

### 1.1 Dual Ownership of Guidance (CRITICAL - Severity: High, Likelihood: Certain)

**Risk**: `CustomStage.guidance` already exists and stores guidance text. The proposal adds `AdventureStage.guidance` alongside it. Two entities now own "guidance" for what is semantically the same stage content, creating a source-of-truth ambiguity.

**Current state**:
- `CustomStage` has `guidance?: string` — authored in CustomStageEditor
- `AdventureStage` has `description?: string` — populated from `source.guidance` in `addToRoute()` (line 156 of AdventureEditor.tsx)
- `getAdventureStages()` falls back: `description: stage.description || sourceStage.guidance` (line 303 of useAppStore.ts)

**What happens in these scenarios**:
| Scenario | CustomStage.guidance | AdventureStage.description | AdventureStage (new) .guidance | Expected behavior? |
|---|---|---|---|---|
| 1. Guidance exists on source, teacher adds to adventure route | "Read C# carefully" | "Read C# carefully" (auto-copied) | undefined | Duplicate, but currently consistent |
| 2. Teacher edits guidance in AdventureEditor | "Read C# carefully" | "Read C# carefully" | "NEW guidance" | WHICH ONE WINS? |
| 3. Teacher edits source stage guidance after adding to route | "UPDATED guidance" | stale "Read C# carefully" | undefined | Guidance drift — student sees stale text |
| 4. Both guidance and description set on AdventureStage | "Read C# carefully" | "Some old desc" | "New guidance" | Three-way conflict |

**Mitigation**: Must define a clear precedence chain. Recommended: `AdventureStage.guidance` > `CustomStage.guidance` > `AdventureStage.description` > nothing. Document this explicitly. But this still creates a maintenance burden — every time you resolve guidance for display, you must check three fields.

### 1.2 `description` Field Collision (Severity: High, Likelihood: High)

**Risk**: The `AdventureStage.description` field currently serves dual purpose:
1. Displayed as the stage subtitle on the student adventure map (line 305-307 of AdventureEditor.tsx: "stage.desc")
2. Used as fallback guidance in `getAdventureStages()` (line 303 of useAppStore.ts)

If we add `guidance` to AdventureStage, what does `description` mean?
- Is `description` the "card subtitle" (shown on the map node)?
- Is `guidance` the "learning guide" (shown as modal before quiz)?
- Are they the same thing? Different?

Currently in AdventureEditor line 305-307, `stage.description` IS displayed on the route cards. If `description` was previously auto-populated from `source.guidance` (line 156), then teachers may have already edited description text thinking it IS the guidance. Adding a separate `guidance` field alongside `description` without clearly distinguishing their UI roles will confuse teachers.

**Mitigation**: Rename `description` to `subtitle` on AdventureStage to clarify it is NOT guidance, OR merge them into a single field with clear semantics. Do NOT have two separate text fields with overlapping purposes.

### 1.3 Missing Database Column (Severity: High, Likelihood: Certain)

**Risk**: The `adventure_routes` table has NO `guidance` column. The SupabaseStorageProvider's `save()` method writes adventure stages without guidance. The load path also doesn't populate guidance for adventure stages.

Current `adventure_routes` columns:
```
id, route_name, stage_order, title, description, source_stage_id,
source_module, question_count, unlock_rule, source, created_at, updated_at
```

If guidance is added to AdventureStage in the store but NOT in `adventure_routes`, then guidance is lost on publish → reload cycles. Teachers will author guidance, publish, refresh, and find their guidance gone.

**Mitigation**: Must add `guidance TEXT` column to `adventure_routes` AND update both `SupabaseStorageProvider.save()` and `SupabaseStorageProvider.load()` to handle it. Also update `syncOps.ts` if any incremental sync path exists for adventure stages (currently it does not).

### 1.4 Existing Rows Have No Guidance (Severity: Medium, Likelihood: Certain)

**Risk**: Adding a `guidance` column to `adventure_routes` means all existing rows get `NULL`. On load, this is fine (guidance is undefined/empty). But the suppression logic in InteractiveQuiz uses:
```typescript
const suppressed = readSuppressedMap()[stageId] === guidance;
```
If guidance was previously undefined and now exists, previously suppressed modals will re-appear. More critically, the suppression key was `stageId + guidance hash` — if the stageId format changes (see section 2), ALL previously suppressed modals will show again regardless.

**Mitigation**: This is acceptable as a one-time event, but should be documented as a breaking change so the team isn't surprised when students who had "不再提示" checked suddenly see guidance modals again.

---

## 2. Migration Risks

### 2.1 Orphaned Guidance in CustomStageEditor (Severity: High, Likelihood: High)

**Risk**: If guidance editing is "moved" to AdventureEditor, what happens to existing guidance text sitting in `CustomStage.guidance`? There are two categories:

**Category A — Stages already added to adventure routes**: Their guidance was auto-copied to `AdventureStage.description` on `addToRoute()` (line 156). After migration, should we:
- (a) Copy `CustomStage.guidance` → `AdventureStage.guidance` for all existing routes?
- (b) Leave it in `CustomStage.guidance` and prefer that at display time?
- (c) Delete it from `CustomStage` after copy?

**Category B — Stages NOT in any adventure route**: Their guidance lives only in `CustomStage.guidance`. If the CustomStageEditor guidance editor is removed, teachers can no longer edit this text. But the stage may be added to a route later — at which point the guidance should come along.

**Mitigation**: If the guidance field stays on `CustomStage` (as storage only, not editable in CustomStageEditor UI), then when adding a stage to a route, guidance should be copied from `CustomStage.guidance` into `AdventureStage.guidance` at that time. This is a one-time copy, so subsequent changes to `CustomStage.guidance` (if any remain editable) would NOT propagate — this must be documented.

### 2.2 No Backfill Strategy (Severity: Medium, Likelihood: Medium)

**Risk**: The proposal describes moving guidance but does not specify a backfill strategy for existing data. Without a migration script:
- Guidance text authored in CustomStageEditor for stages that are already in adventure routes will not automatically appear in AdventureEditor
- Teachers will see empty guidance fields in AdventureEditor for existing stages and may re-author guidance that already exists, creating duplicates

**Mitigation**: Write a one-time migration that iterates all AdventureStages, finds their source CustomStage, and copies `CustomStage.guidance` → `AdventureStage.guidance` (if AdventureStage.guidance is not already set). This can be a standalone script or a one-time useEffect in AdventureEditor.

### 2.3 Guidance Display for Non-Adventure Stages (Severity: Medium, Likelihood: High)

**Risk**: The proposal focuses on adventure stages, but what about non-adventure (free practice) stages accessed through the module-based practice flow (`/client/stages` -> `InteractiveQuiz`)? These stages:
- Have stageId format `custom_xxx` (not `adventure_route_xxx`)
- Currently CAN show guidance (because `customStages.find(cs => cs.id === stageId)` in InteractiveQuiz line 243 finds them)
- Will lose guidance editing capability if it's removed from CustomStageEditor

If the proposal intends to remove guidance editing from CustomStageEditor entirely, free-practice stages will become uneditable for guidance. If the proposal intends to KEEP guidance in CustomStageEditor AND add it to AdventureEditor, then we have the dual ownership problem described in 1.1.

**Mitigation**: Clarify whether guidance editing stays in CustomStageEditor or is removed. If removed, ensure guidance still DISPLAYS for custom stages in InteractiveQuiz (the read path should stay, just the edit UI moves).

---

## 3. Student Display Logic Risks

### 3.1 Guidance Resolution in InteractiveQuiz is Fundamentally Broken for Adventure Stages (Severity: HIGH, Likelihood: CERTAIN)

**The current bug in InteractiveQuiz** (lines 242-248):
```typescript
const customStages = useAppStore(state => state.customStages);
const stageRecord = customStages.find(cs => cs.id === stageId);
const guidance = stageRecord?.guidance?.trim() ?? '';
```

This code looks up guidance by `stageId` in `customStages`. Adventure stage IDs are `adventure_route_xxx`, which will NEVER match a custom stage ID (which is `custom_xxx`). This means:
- **For adventure stages, `stageRecord` is always `undefined`**
- **`guidance` is always empty string `''`**
- **`introDismissed` is always `true`** (line 246: `if (!stageId || !guidance) return true`)
- **The GuidanceModal at line 574 NEVER renders for adventure stages**

This is an existing production bug, not a new risk from the proposal. However, the proposal must fix it.

**The fix** must change guidance resolution to check adventure stages too:
```typescript
// Pseudocode for the fix
const customRecord = customStages.find(cs => cs.id === stageId);
const adventureRecord = stageId?.startsWith('adventure_route_')
  ? adventureStages.find(s => s.id === stageId)
  : null;
const guidance = customRecord?.guidance ?? adventureRecord?.guidance ?? '';
```

**Important**: The `stageRecord` is also used to get the `title` for the GuidanceModal (line 577). For adventure stages, the title should come from the adventure stage, not the custom stage (which won't be found anyway).

### 3.2 Suppression Logic Breaks for Adventure Stages (Severity: High, Likelihood: High)

**Current suppression logic** (InteractiveQuiz lines 158-176):
```typescript
function readSuppressedMap(): Record<string, string> {
  return JSON.parse(localStorage.getItem(GUIDANCE_SUPPRESS_KEY) ?? '{}');
}
function writeSuppressed(stageId: string, guidanceSnapshot: string): void {
  const map = readSuppressedMap();
  map[stageId] = guidanceSnapshot;
  localStorage.setItem(GUIDANCE_SUPPRESS_KEY, JSON.stringify(map));
}
// Usage:
const [introDismissed, setIntroDismissed] = useState(() => {
  if (!stageId || !guidance) return true;
  return readSuppressedMap()[stageId] === guidance;
});
```

The suppression key is `stageId`:
- For custom stages: `custom_1234567890`
- For adventure stages: `adventure_route_custom_1234567890_1`

**Risks**:
1. Adventure stage IDs include `sourceStageId` + a count suffix. If the same source stage is added twice to a route (possible), each has a different `adventure_route_xxx` ID. Suppression for one does NOT suppress the other — correct behavior, but could confuse teachers who add the same stage twice.
2. If the ID generation logic changes (currently `adventure_route_${source.id}_${existingCount + 1}`), all existing suppression records become stale and guidance re-appears for everyone.
3. If guidance text is edited (hash changes), the suppression check `readSuppressedMap()[stageId] === guidance` fails, and the modal re-appears. This is correct behavior, but teachers should be aware that editing guidance resets suppression for all students who had checked "不再提示".

**Mitigation**: The current suppression logic is sound — it compares the full guidance text, so edits naturally invalidate suppression. But document that changing ID generation format will break ALL existing suppression records.

### 3.3 Guidance Resolution Path Needs Rewrite (Severity: Medium, Likelihood: Certain)

Currently, InteractiveQuiz resolves guidance through a single path:
```
stageId → customStages.find(cs.id === stageId) → .guidance
```

After the proposal, the resolution needs to be:
```
if (stageId starts with 'adventure_route_'):
  → adventureStages.find(s.id === stageId) → .guidance  (NEW primary)
  → fallback to customStages.find(cs.id === stage.sourceStageId) → .guidance  (backward compat)
else:
  → customStages.find(cs.id === stageId) → .guidance  (current path)
```

This is a non-trivial refactor of the guidance lookup. The proposal does not appear to account for the complexity of this resolution logic.

---

## 4. Image Upload Risks

### 4.1 Image Association Ambiguity (Severity: Medium, Likelihood: High)

**Risk**: Images are uploaded to `stage-guidance-images` bucket with random filenames. URLs are embedded as `![alt](url)` in the guidance markdown. Currently, images are associated with custom stages only implicitly (they appear in the markdown). If guidance editing moves to AdventureEditor:

- An image uploaded while editing an adventure stage is referenced in `AdventureStage.guidance` markdown
- The same image is NOT referenced in `CustomStage.guidance`
- If the custom stage is later added to a DIFFERENT adventure route, the images won't carry over
- If the custom stage's guidance is viewed standalone, the image won't appear

**This is acceptable** if we treat AdventureStage.guidance as independent content. But it creates confusion when a teacher sees "there are images in the guidance" in AdventureEditor but not in CustomStageEditor for the same source stage, or vice versa.

**Mitigation**: When a teacher uploads an image in AdventureEditor, store the image reference ONLY in AdventureStage.guidance. Do NOT attempt to backfill it to CustomStage.guidance. This keeps the data model clean but means image-rich guidance exists in two places with potentially different content.

### 4.2 Orphan Image Proliferation (Severity: Low, Likelihood: Medium)

**Risk**: The current codebase already acknowledges orphan images (guidanceImageUpload.ts line 31 comment: "Image objects are NOT cleaned up when guidance text is deleted — leaving orphan cleanup as a follow-up admin tool"). Adding a second editing surface where images can be uploaded compounds this problem:

- Images uploaded in CustomStageEditor are referenced in `CustomStage.guidance`
- Images uploaded in AdventureEditor are referenced in `AdventureStage.guidance`
- When a guidance text is deleted/overwritten, the images remain in storage
- There are now TWO surfaces generating orphan images instead of one

**Mitigation**: Acceptable given the existing acknowledged behavior. If orphan cleanup is ever implemented, it must scan BOTH `CustomStage.guidance` and `AdventureStage.guidance` markdown for image URL references.

### 4.3 UI Duplication (Severity: Low, Likelihood: Certain)

**Risk**: The CustomStageEditor guidance section (lines 244-332) includes:
- Textarea with Markdown support
- Image upload button
- Drag-and-drop image upload
- Paste image upload
- Upload progress/error status
- Live Markdown preview with `remarkPlugins`

Moving this to AdventureEditor means either:
- **Duplicating all this UI code** (~90 lines) in AdventureEditor — violating DRY
- **Extracting a shared component** — better, but the guidance editor is tightly coupled to CustomStageEditor state (`guidance`, `uploadStatus`, `textareaRef`, `fileInputRef`)

The current `EditableFields` component in AdventureEditor (lines 71-103) is a simple title + description form. Adding guidance + image upload would balloon it into a complex component with file handling, drag/drop, paste events, upload status management, and Markdown preview.

**Mitigation**: Extract a `GuidanceEditor` shared component from the relevant portion of CustomStageEditor. Both editors import it. This is the right architectural move regardless of whether guidance moves.

---

## 5. Sync & Publishing Risks

### 5.1 Sync Architecture Doesn't Handle AdventureStage Mutations (Severity: High, Likelihood: High)

**Risk**: Looking at `syncOps.ts`, the sync architecture is:
- `syncUpsertStage()` — syncs a `CustomStage` to the `stages` table
- `syncSoftDeleteStage()` — soft-deletes from `stages` table
- **There is NO sync function for adventure stages**

Adventure stages are only persisted through the full `publish()` flow in `usePublish.ts` -> `SupabaseStorageProvider.save()`. The incremental `syncUpsert*` pattern used for slices and custom stages does NOT exist for adventure stages.

This means:
- If a teacher edits guidance in AdventureEditor and navigates away WITHOUT clicking "Publish Route", the guidance is saved only in Zustand persist (localStorage)
- If the "Publish Route" button is not pressed, guidance NEVER reaches Supabase
- Students won't see the guidance until the teacher publishes

**Mitigation**: Either:
(a) Add a `syncUpsertAdventureStage()` function similar to `syncUpsertStage()` so individual guidance edits are fire-and-forget synced, OR
(b) Document clearly that guidance changes require clicking "Publish Route" to take effect

Note: The current `usePublish` (useRemoteSync.ts lines 30-35) explicitly calls `provider.save()` with the full state. This IS the correct path for batch publishing. But if teachers expect guidance edits to save immediately (like they do for custom stage edits via `syncUpsertStage`), they'll be confused.

### 5.2 SupabaseStorageProvider.save() Doesn't Write Guidance to adventure_routes (Severity: HIGH, Likelihood: CERTAIN)

**Risk**: The `SupabaseStorageProvider.save()` method (lines 233-251) writes adventure stages to `adventure_routes` BUT:
```typescript
const rows = stages.map((s) => ({
  route_name: 'main',
  stage_order: s.levelNum,
  title: s.title,
  description: s.description || null,
  source_stage_id: s.sourceStageId,
  source_module: s.sourceModule,
  question_count: s.questionCount,
  unlock_rule: s.unlockRule,
  source: s.source || 'manual',
  updated_at: new Date().toISOString(),
}));
```

There is NO `guidance` field here. Even if `AdventureStage.guidance` exists in the store, it is dropped during publish. On subsequent load, the guidance would be gone.

**Mitigation**: Add `guidance: s.guidance || null` to this row mapping AND add `guidance` to the `adventure_routes` table via a new migration.

### 5.3 SupabaseStorageProvider.load() Doesn't Populate Guidance for Adventure Stages (Severity: HIGH, Likelihood: CERTAIN)

**Risk**: Looking at the load path (lines 314-329):
```typescript
adventureStages = (routeRows as any[]).map((r) => ({
  id: ...,
  title: r.title,
  description: r.description || undefined,
  levelNum: r.stage_order,
  sourceStageId: r.source_stage_id,
  sourceModule: r.source_module as AdventureStage['sourceModule'],
  questionCount: r.question_count,
  unlockRule: 'previous_clear' as const,
  source: ...,
  createdAt: ...,
  updatedAt: ...,
}));
```

No `guidance` is populated here. Even if the column is added to `adventure_routes`, the load code must be updated to read it.

**Mitigation**: Update the load mapping to include `guidance: r.guidance || undefined`.

### 5.4 The `description` Already Carries Guidance in the Sync Path (Severity: Medium, Likelihood: Medium)

**Risk**: Currently, `AdventureStage.description` is set from `source.guidance` on `addToRoute()` (line 156). This means `adventure_routes.description` already contains what was the custom stage's guidance. If we add a separate `guidance` column:

1. Existing data in `adventure_routes.description` is former guidance text
2. New data would go into `adventure_routes.guidance`
3. We now have `description` (which may be old guidance) and `guidance` (new field) — possible duplication

**Mitigation**: Migration should:
- For existing rows: `UPDATE adventure_routes SET guidance = description WHERE guidance IS NULL`
- Or: Keep them separate and use guidance resolution precedence

---

## 6. UX Risks

### 6.1 Editor Complexity Blowup (Severity: Medium, Likelihood: High)

**Risk**: The current `EditableFields` component is ~30 lines — a simple form with title input and description textarea. Adding guidance editor + image upload would make it ~120 lines with:
- File input ref
- Textarea ref for cursor position
- Paste/drag-drop event handlers
- Upload status state machine
- Markdown preview toggle
- Error/success feedback

This makes the "edit" modal in AdventureEditor nearly as complex as the entire stage creation form in CustomStageEditor.

**Mitigation**: Extract a shared `GuidanceEditor` component (as mentioned in 4.3). Also consider whether guidance should be a separate "edit" action rather than lumped into the existing inline edit form.

### 6.2 Teacher Confusion: Two Places to Edit Guidance (Severity: Medium, Likelihood: High)

**Risk**: If guidance editing is added to AdventureEditor but NOT removed from CustomStageEditor, teachers will have two places to edit guidance for the same logical stage. They may:
- Edit in one place, forget the other
- Expect changes in one to propagate to the other (they won't)
- Get confused about which guidance students actually see

**Mitigation**: Either:
(a) Remove guidance editing from CustomStageEditor entirely (clear separation), OR
(b) Remove guidance editing from AdventureEditor and fix the display bug instead (simpler fix — see Alternate Approach below)

### 6.3 Unclear What Drives the "Edit" Button UX (Severity: Low, Likelihood: Medium)

**Risk**: In AdventureEditor, clicking the edit button (Pencil icon, line 318) currently opens `EditableFields` for title + description. The proposal wants to change this to a modal with guidance + image upload. But the existing `EditableFields` is inline, not a modal. What about the "navigate to source stage" button (line 320, ExternalLink icon)?

If the edit modal takes over, does the external link to source stage still exist? Does it conflict with the new guidance editing surface? The proposal needs to specify the exact UX flow.

---

## 7. Edge Cases

### 7.1 Same Custom Stage Added to Route Multiple Times (Severity: Medium, Likelihood: Low)

**Risk**: A custom stage CAN be added to an adventure route multiple times (line 152-164: `existingCount` check, each creates a new `adventure_route_xxx` ID). If a teacher adds "Basic Notes" three times, they get three separate adventure stages with the same source.

Each of these would have:
- Different `AdventureStage.id` (correct)
- Potentially different `AdventureStage.guidance` if the teacher edits each independently

This is confusing. If the teacher edits guidance on one, it shouldn't affect the others. But the teacher may expect "all instances of Basic Notes share the same guidance."

**Mitigation**: This is correct behavior (independent editing), but should be documented. Consider a UI indicator showing which source stage each adventure stage comes from, to help teachers understand why guidance might differ between similar-named stages.

### 7.2 Custom Stage Deleted But Adventure Stage Still Exists (Severity: Medium, Likelihood: Medium)

**Risk**: Currently, `removeCustomStage` checks if any adventure stage references the custom stage and throws an error (useAppStore.ts lines 398-403):
```typescript
const referencingAdventure = state.adventureStages.find(stage => stage.sourceStageId === id);
if (referencingAdventure) {
  throw new Error(`无法删除：此关卡正在被冒险路线中的关卡「${referencingAdventure.title}」引用`);
}
```

If we add `AdventureStage.guidance`, this check still works. But after deletion, the adventure stage still exists with:
- `sourceStageId` pointing to a deleted stage
- Its own `guidance` (if set) — preserved correctly
- But the `getAdventureStages()` function would show it as having no source stage (lines 283-293)

If the guidance was NEVER set on the adventure stage (only existed on the now-deleted custom stage), students would see no guidance — the fallback to `sourceStage.guidance` would fail because the source stage is gone.

**Mitigation**: When setting guidance on an adventure stage, encourage teachers to duplicate the guidance content rather than relying on fallback. Or, prevent deletion of custom stages that have adventure stages referencing them (already done).

### 7.3 Guidance Exists in Both Places with Different Content (Severity: Medium, Likelihood: Medium)

**Risk**: Teacher edits `CustomStage.guidance` (in CustomStageEditor) AND later edits `AdventureStage.guidance` (in AdventureEditor) with different content. Students see `AdventureStage.guidance` (per the resolution precedence). Teacher forgets about the CustomStage version and later wonders why her edits in CustomStageEditor aren't showing up.

This is a data consistency problem with no good solution. The two fields are independent and WILL diverge over time.

**Mitigation**: If the intended design is that AdventureStage.guidance is THE authoritative source for adventure stages, then:
- The AdventureEditor should show a warning: "This guidance overrides the source stage's guidance"
- The CustomStageEditor should not show guidance editing at all (removed from UI)
- A migration should copy existing CustomStage.guidance to AdventureStage.guidance for all referenced stages

### 7.4 Student Re-enters a Completed Adventure Stage (Severity: Low, Likelihood: High)

**Risk**: The requirement states "Students should see guidance every time they re-enter a stage (the current '不再提示' suppression checkbox is optional)." But the current implementation shows guidance on EVERY entry unless suppressed:

```typescript
// InteractiveQuiz line 158-176, 245-248
const [introDismissed, setIntroDismissed] = useState(() => {
  if (!stageId || !guidance) return true;
  return readSuppressedMap()[stageId] === guidance;
});
```

If the "不再提示" checkbox is optional or removed, students who FINISH the stage, navigate away, and come back will see guidance AGAIN. For students who already know the material, this is annoying. For short guidance (one sentence), it's unnecessary friction.

**Mitigation**: If "always show on re-entry" is desired, clear the suppression entry when the student navigates to the quiz (`setIntroDismissed(true)` without writing to suppressed map). OR keep the checkbox as optional but default unchecked, so advanced students can suppress it.

### 7.5 Adventure Stage with No Source Custom Stage (Severity: Low, Likelihood: Low)

**Risk**: What if an `AdventureStage` somehow has `sourceStageId` set to a non-existent ID (data corruption, legacy data, etc.)? The `getAdventureStages()` function handles this by returning empty slices (lines 283-293). But for guidance resolution:

```typescript
const guidance = adventureRecord?.guidance ?? sourceStage?.guidance ?? '';
```

If `adventureRecord` has no guidance set AND `sourceStageId` points to a deleted stage, guidance is `''`. This is safe (no crash), but the guidance modal won't show.

---

## 8. Architectural Consistency Risks

### 8.1 Breaking the "AdventureStage References, Does Not Own Content" Principle (Severity: High, Likelihood: High)

**Risk**: The original design decision (from `openspec/changes/add-adventure-learning-path/design.md`) is explicit:

> **Decision 1: AdventureStage 独立于 CustomStage**
> 独立模型允许未来扩展路线专属字段（如建议练习时长、通关分数要求）而不影响现有关卡
> 软引用避免数据冗余：删除 customStage 不影响 adventureStages 数组结构

Adding `guidance` to AdventureStage is exactly the kind of "route-specific field extension" the spec anticipated. **However**, guidance is unique because it also exists on the source (`CustomStage.guidance`). The design principle was "soft reference, no data duplication." Guidance is the FIRST field that breaks this principle by duplicating content.

The proposal needs to justify WHY guidance is different from, say, title or sliceIds (which are NOT duplicated). Is it because teachers need route-specific guidance? If so, this should be a conscious design reversal, not an oversight.

### 8.2 The Simpler Fix: Don't Move Guidance, Fix the Bug (Severity: N/A, Likelihood: N/A)

**Alternate approach**: Instead of moving guidance editing to AdventureEditor, fix the InteractiveQuiz bug with a much smaller change:

**Current bug**: InteractiveQuiz line 243: `customStages.find(cs => cs.id === stageId)` doesn't find adventure stages.

**Fix**: Change the guidance resolution to also check adventure stages:
```typescript
const adventureStages = useAppStore(state => state.adventureStages);
const stageRecord = customStages.find(cs => cs.id === stageId);
const adventureRecord = stageId?.startsWith('adventure_route_')
  ? adventureStages.find(s => s.id === stageId)
  : null;
const sourceStage = adventureRecord
  ? customStages.find(cs => cs.id === adventureRecord.sourceStageId)
  : null;
const guidance = stageRecord?.guidance
  ?? adventureRecord?.description  // description already contains guidance from addToRoute()
  ?? sourceStage?.guidance
  ?? '';
```

This is a ~10-line fix that:
1. Fixes guidance display for adventure stages using EXISTING data
2. Doesn't require new database columns
3. Doesn't require new UI in AdventureEditor
4. Doesn't create data model ambiguity
5. Doesn't require migration
6. Doesn't break suppression logic

**Trade-off**: Teachers can't customize guidance per adventure stage. They can only edit it in CustomStageEditor, and it auto-populates to adventure stages. This is the simpler approach.

**When the proposal is still justified**: If the requirement is truly "teachers need per-adventure-stage guidance that differs from the source stage's guidance," then moving the editor is the right call. But this requirement should be explicit.

---

## 9. Implementation Risk Summary Table

| ID | Risk | Severity | Likelihood | Effort to Mitigate |
|---|---|---|---|---|
| 1.1 | Dual ownership of guidance | High | Certain | Medium — define precedence, document |
| 1.2 | Description field collision | High | High | Medium — rename or merge |
| 1.3 | Missing DB column (adventure_routes) | High | Certain | Low — add column, update save/load |
| 1.4 | Existing rows have NULL guidance | Medium | Certain | Low — handled by nullish coalescing |
| 2.1 | Orphaned guidance in CustomStageEditor | High | High | Medium — migration script |
| 2.2 | No backfill strategy | Medium | Medium | Medium — one-time migration |
| 2.3 | Free-practice stages lose guidance editing | Medium | High | Low — keep field in CustomStageEditor |
| 3.1 | Guidance resolution broken for adventure | HIGH | CERTAIN | Low — fix lookup in InteractiveQuiz (BUG) |
| 3.2 | Suppression logic breaks | High | High | Low — document behavior change |
| 3.3 | Guidance resolution path rewrite needed | Medium | Certain | Medium — multi-source lookup |
| 4.1 | Image association ambiguity | Medium | High | Low — document as expected behavior |
| 4.2 | Orphan image proliferation | Low | Medium | Low — same as existing behavior |
| 4.3 | UI duplication | Low | Certain | Medium — extract shared component |
| 5.1 | No incremental sync for adventure stages | High | High | Medium — add sync function |
| 5.2 | save() drops guidance | HIGH | CERTAIN | Low — add field to row mapping |
| 5.3 | load() drops guidance | HIGH | CERTAIN | Low — add field to load mapping |
| 5.4 | description already carries guidance | Medium | Medium | Medium — migration to separate |
| 6.1 | Editor complexity blowup | Medium | High | Medium — extract shared component |
| 6.2 | Two places to edit guidance | Medium | High | Medium — remove from CustomStageEditor |
| 6.3 | Unclear edit UX | Low | Medium | Low — specify modal UX |
| 7.1 | Same stage added multiple times | Medium | Low | Low — document behavior |
| 7.2 | Deleted custom stage, guidance lost | Medium | Medium | Low — guard already exists |
| 7.3 | Guidance content divergence | Medium | Medium | Medium — clear ownership rules |
| 7.4 | Re-entry guidance friction | Low | High | Low — keep suppression checkbox |
| 7.5 | Orphan sourceStageId | Low | Low | Low — already handled by fallback |
| 8.1 | Breaking design principle | High | High | High — justify divergence from spec |
| 8.2 | Simpler fix exists | N/A | N/A | N/A — evaluate requirements |

---

## 10. Recommendations

### If the Goal is Minimal Fix (Recommended):

**Don't move guidance editing. Fix the bug in InteractiveQuiz.**

1. Fix `InteractiveQuiz.tsx` lines 242-248 to resolve guidance from adventure stages (looking up `AdventureStage.description` which already carries the guidance from `addToRoute()`)
2. This is a ~10-line change, no migrations, no data model changes, no new UI
3. Teachers continue editing guidance in CustomStageEditor, and it propagates to adventure stages automatically via `addToRoute()`

### If the Goal is Full Per-Stage Guidance Customization:

1. **Add `guidance` column** to `adventure_routes` table (new SQL migration)
2. **Add `guidance` to `AdventureStage`** interface in useAppStore.ts
3. **Update `SupabaseStorageProvider.save()`** to write guidance to adventure_routes
4. **Update `SupabaseStorageProvider.load()`** to read guidance from adventure_routes
5. **Fix `InteractiveQuiz.tsx`** to resolve guidance from AdventureStage (using precedence: `adventureRecord.guidance` > `sourceStage.guidance` > `adventureRecord.description` > nothing)
6. **Extract shared `GuidanceEditor` component** from CustomStageEditor
7. **Use it in both AdventureEditor and CustomStageEditor** (or remove from CustomStageEditor if intended)
8. **Write migration script** to backfill `AdventureStage.guidance` from `CustomStage.guidance` for existing route stages
9. **Document behavior** of guidance resolution precedence, suppression logic changes, and the two-ownership problem

### Regardless of Approach:

- Fix the bug in InteractiveQuiz (section 3.1) — it's a production issue even without the proposal
- Document suppression key format stability for localStorage
