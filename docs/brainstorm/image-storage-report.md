# Image Storage and Serving: Investigation Report

## 1. Where Images Are Stored

**Bucket**: `stage-guidance-images` (Supabase Storage, public bucket)

**Path structure**: Flat — `{randomUUID}.{ext}` (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890.png`)

Key properties:
- No subdirectories by stage/module (the design explicitly chose flat paths because stages can be renamed/moved, and the markdown URL is the stable reference).
- Extension is derived from the original filename, falling back to MIME type, then to `bin`.
- Filename is generated via `crypto.randomUUID()` (with a Math.random polyfill fallback).

Source: `src/components/guidanceImageUpload.ts` line 43

---

## 2. Upload Flow

### Entry Points (all in `src/pages/cms/CustomStageEditor.tsx`)

Three ways a teacher can upload:

| Method | Implementation | Lines |
|---|---|---|
| **Click button** | Hidden `<input type="file" accept="image/*">` triggered by "📷 插入图片" button; onChange fires `runUploads(files)` | 257-276 |
| **Drag-and-drop** | `onDrop` on textarea extracts `dataTransfer.files`, filters `image/*`, calls `runUploads(files)` | 299-304 |
| **Clipboard paste** | `onPaste` checks `clipboardData.items` for `kind === 'file' && type.startsWith('image/')`, calls `runUploads(files)` | 284-297 |

### Upload Function (`src/components/guidanceImageUpload.ts`)

`uploadGuidanceImage(file: File): Promise<string>`

**Validation** (in order):
1. Supabase must be configured (checks `supabase !== null`)
2. `file.type` must start with `image/` — throws `GuidanceImageUploadError` if not
3. `file.size` must be <= 5 MB — throws `GuidanceImageUploadError` if exceeded

**Upload call**:
```ts
supabase.storage.from('stage-guidance-images').upload(path, file, {
  cacheControl: '31536000',   // 1 year browser cache
  upsert: false,              // never overwrite (random paths prevent collision anyway)
  contentType: file.type,
})
```

**Error handling**: Upload errors throw `GuidanceImageUploadError` which is caught in `runUpload()` in `CustomStageEditor.tsx`. The error message is displayed inline next to the upload button for 4 seconds.

**Success**: Returns the public URL via `supabase.storage.from(BUCKET).getPublicUrl(path).publicUrl`.

**After upload**: The URL is inserted into the guidance markdown at the current cursor position as `![alt](url)` (alt text = filename without extension). This happens via `insertAtCursor()` which handles both textarea-aware (cursor position) and fallback (append to end) cases.

### Sequential Upload with Feedback

- `runUploads(files)` iterates files **sequentially** (`for...of` loop) — each file uploads one at a time.
- Upload status is tracked as `{ kind: 'idle' } | { kind: 'uploading', name } | { kind: 'error', msg }` and displayed next to the upload button.
- The upload button is disabled while any upload is in progress.

---

## 3. Storage and Retrieval (How Students See Images)

### Serving

The bucket is **public** (`public: true` in the SQL migration). Images are served directly from Supabase Storage via their public URL, which follows the pattern:
```
https://<project>.supabase.co/storage/v1/object/public/stage-guidance-images/<path>
```

Students access images **without any authentication** — the bucket's public-read RLS policy (`guidance_images_public_read`) allows `SELECT` by `public` (anyone, including unauthenticated users).

### Rendering on the Student Side

1. Student opens a stage → `InteractiveQuiz.tsx` checks `stageRecord?.guidance?.trim()`
2. If non-empty guidance exists and is not suppressed → renders `<GuidanceModal>` component
3. `GuidanceModal.tsx` renders the guidance string through `ReactMarkdown` with `remarkGfm` and `remarkBreaks` plugins
4. The `img` component is overridden:
   ```tsx
   img: ({ src, alt }) => (
     <img src={src} alt={alt ?? ''}
       style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', display: 'block', margin: '8px 0' }}
     />
   )
   ```
5. The browser fetches the image directly from Supabase Storage public URL
6. No auth headers or tokens are needed — the bucket is public

### Suppression (localStorage)

- Students can check "不再提示此关卡" to suppress the modal on future visits.
- Suppression state is stored in `localStorage['stage_guidance_suppressed']` as `{stageId: guidanceText}`.
- The **full guidance text** is used as the comparison key — if the teacher edits even one character, the suppression is broken and the modal re-shows.
- Wrapped in try/catch for Safari Private Browsing compatibility.

---

## 4. RLS Policies and Security

Defined in `docs/supabase/migration_create_guidance_images_bucket.sql`:

| Policy | Target | Scope | Condition |
|---|---|---|---|
| `guidance_images_public_read` | SELECT | `public` (anyone, no auth) | `bucket_id = 'stage-guidance-images'` |
| `guidance_images_admin_insert` | INSERT | `authenticated` | `bucket_id = 'stage-guidance-images'` AND `(select role from public.profiles where id = auth.uid()) = 'admin'` |
| `guidance_images_admin_delete` | DELETE | `authenticated` | `bucket_id = 'stage-guidance-images'` AND `(select role from public.profiles where id = auth.uid()) = 'admin'` |

Key security properties:
- **Anyone can read** (including unauthenticated visitors) — this is by design for direct `<img>` tag loading without client-side auth.
- **Only admin role can upload and delete** — checked via the `public.profiles` table.
- **Authenticated non-admin users cannot upload/delete** — they are silently rejected by RLS.
- There is **no UPDATE policy** — objects in this bucket cannot be modified once created (consistent with `upsert: false` in the upload code; if a UUID collision ever occurred, the upload would simply fail).
- The SQL migration is idempotent (uses `on conflict (id) do nothing` and `drop policy if exists`).

---

## 5. How Image URLs Are Embedded in Guidance Markdown

The guidance text is a plain markdown string stored in the `guidance` column of `public.stages`.

When an image is uploaded, the URL is inserted as:
```markdown
![filename_without_extension](https://<project>.supabase.co/storage/v1/object/public/stage-guidance-images/<uuid>.<ext>)
```

Example rendered guidance string:
```markdown
这一关主要练习升降号识别。

![C大调音阶](https://abc.supabase.co/storage/v1/object/public/stage-guidance-images/a1b2c3d4-e5f6-7890-abcd-ef1234567890.png)

**注意**：C# 和 Db 是同一个琴键。
```

The guidance string is:
1. **Created** in `CustomStageEditor.tsx` — teacher types markdown, uploads insert `![...](url)` at cursor
2. **Saved** to zustand store as `CustomStage.guidance` (stored in React state)
3. **Persisted** to Supabase `public.stages.guidance` column by `SupabaseStorageProvider.save()` and `syncOps.ts`
4. **Loaded** by `SupabaseStorageProvider.load()` which SELECTs the `guidance` column (maps DB null to JS undefined)
5. **Rendered** by `GuidanceModal.tsx` via `ReactMarkdown` with custom `img` component

---

## 6. Orphan Cleanup

**There is NO orphan cleanup mechanism.** This is an explicit design decision documented in multiple places:

- In `guidanceImageUpload.ts` line 28-31 (comment):
  > "Image objects are NOT cleaned up when guidance text is deleted — leaving orphan cleanup as a follow-up admin tool."
- In the design spec (`2026-05-25-stage-guidance-v2-design.md`):
  > "不做图片孤儿清理 UI（删除 guidance 不会删除其引用的图片；可单独写一个 admin 工具，本次不做）"
- In risks section:
  > "图片孤儿堆积 → 留给后续 admin 工具"
- In the out-of-scope section:
  > "图片孤儿清理 admin 工具"

### What This Means in Practice

When a teacher:
- Deletes a stage → the guidance text is gone, but the uploaded image files remain in the bucket
- Edits guidance to remove an image markdown → the image file remains
- Replaces an image (uploads a new one with different content) → the old image remains

These orphaned objects accumulate in the bucket over time. RLS does have an `admin_delete` policy ready, but no UI or cron job currently invokes it.

---

## 7. Full Data Flow

```
TEACHER SIDE (CMS):

  [Teacher opens CustomStageEditor.tsx]
       │
       ├── Types/writes guidance markdown in textarea (with live preview)
       │
       ├── Uploads image via: click button / drag-drop / paste
       │     │
       │     └── runUploads(files)
       │           │
       │           └── runUpload(file)  [sequential per file]
       │                 │
       │                 ├── Validates: image/*, <= 5MB
       │                 │
       │                 ├── uploadGuidanceImage(file)
       │                 │     ├── supabase.storage.from('stage-guidance-images').upload(path, file)
       │                 │     │     path = `${randomUUID()}.${ext}`
       │                 │     │
       │                 │     └── supabase.storage.from(BUCKET).getPublicUrl(path)
       │                 │           → returns "https://<project>.supabase.co/storage/v1/object/public/stage-guidance-images/<path>"
       │                 │
       │                 └── insertAtCursor(`![alt](${publicUrl})`)
       │                       → markdown embedded in textarea at cursor position
       │
       ├── Clicks "创建关卡" / "保存修改"
       │     │
       │     └── zustand store: useAppStore.addCustomStage() / updateCustomStage()
       │           → CustomStage.guidance = markdown string with embedded image URLs
       │
       └── Clicks "发布" or auto-sync fires
             │
             └── SupabaseStorageProvider.save()
                   │
                   ├── Upserts slices to public.quizzes
                   ├── Upserts stages to public.stages  (including guidance column)
                   └── Upserts stage_slices to public.stage_quizzes


  DATA AT REST:

    Supabase DB:
      public.stages
        ├── id          TEXT
        ├── module      TEXT
        ├── title       TEXT
        ├── guidance    TEXT  ←  "![C大调音阶](https://...png)\n\n**注意**：..."
        ├── ...
        └── del_status  BOOL

    Supabase Storage:
      stage-guidance-images (public bucket)
        ├── a1b2c3d4-....png
        ├── e5f6a7b8-....jpg
        └── ...


STUDENT SIDE:

  [Student opens stage in InteractiveQuiz.tsx]
       │
       ├── useAppStore reads customStages (loaded via SupabaseStorageProvider.load())
       │     └── stageRecord = customStages.find(cs => cs.id === stageId)
       │           └── guidance = stageRecord.guidance
       │
       ├── Checks localStorage suppression:
       │     readSuppressedMap()[stageId] === guidance ?
       │     → Yes: skip modal (go straight to quiz)
       │     → No: show GuidanceModal
       │
       ├── GuidanceModal renders:
       │     <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
       │       {guidance}
       │     </ReactMarkdown>
       │     │
       │     └── <img src="https://<project>.supabase.co/.../stage-guidance-images/a1b2...png" />
       │           │
       │           └── Browser fetches from Supabase Storage (public URL, no auth needed)
       │
       └── Student clicks "开始答题"
             ├── If "不再提示" checked: localStorage[stageId] = guidance (suppress future)
             └── Enters quiz
```

---

## Key Files

| File | Purpose |
|---|---|
| `src/components/guidanceImageUpload.ts` | Upload helper: validation + Supabase Storage upload + public URL retrieval |
| `src/pages/cms/CustomStageEditor.tsx` | Teacher CMS: textarea, upload UI (click/drag/paste), preview, stage CRUD |
| `src/components/GuidanceModal.tsx` | Student modal: renders guidance markdown with images |
| `src/pages/client/InteractiveQuiz.tsx` | Student quiz: determines whether to show guidance modal, reads guidance from store |
| `src/core/storage/SupabaseStorageProvider.ts` | Save/load stages (including guidance field) to/from Supabase |
| `src/core/storage/syncOps.ts` | Fine-grained sync: writes guidance to stages during incremental save |
| `src/core/storage/types.ts` | `StageData` / `StorageProvider` interfaces |
| `src/core/auth/supabaseClient.ts` | Supabase client initialization |
| `docs/supabase/migration_create_guidance_images_bucket.sql` | Migration: create bucket + all 3 RLS policies |
| `docs/superpowers/specs/2026-05-25-stage-guidance-v2-design.md` | Full design spec with rationale and testing checklist |
