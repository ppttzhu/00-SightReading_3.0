# Change: 题库 Schema 重构

## Why
`slices` 表命名不直观，`type (A/B/C/D)` 与 `module (notes/symbols/theory/patterns)` 并存造成冗余映射，`pitch`/`placement` 独立列与 JSONB `content` 职责重叠。需要在数据库层统一语义，同时恢复被误删的 `auth.sql` 记录文件。

## What Changes
- **BREAKING** `slices` 表重命名为 `quizzes`，`stage_slices` 重命名为 `stage_quizzes`
- **BREAKING** `quizzes.type (A/B/C/D)` 替换为 `quizzes.module (notes/symbols/theory/patterns)`
- **BREAKING** `quizzes.pitch` 和 `quizzes.placement` 列删除（数据已在 `content` JSONB 中）
- 新增 `quizzes.last_updated_by UUID`、`stages.last_updated_by UUID`、`stage_quizzes.last_updated_by UUID`
- 恢复 `docs/supabase/auth.sql` 作为独立执行记录
- 前端 `Slice.type` 字段替换为 `Slice.module`，所有 `TYPE_TO_MODULE` 映射层删除
- `SupabaseStorageProvider`、`syncOps`、`useAppStore`、`Extractors`、CMS 组件同步更新

## Impact
- Affected specs: 新 `quiz-storage`
- Affected code: `docs/supabase/sightreading.sql`（重建）、`docs/supabase/auth.sql`（恢复）、`src/core/engine/Extractors.ts`、`src/core/storage/SupabaseStorageProvider.ts`、`src/core/storage/syncOps.ts`、`src/core/store/useAppStore.ts`、`src/pages/client/InteractiveQuiz.tsx`、`src/pages/cms/CustomStageEditor.tsx`、`src/pages/cms/ManualCreator.tsx`、`src/pages/cms/StageBuilder.tsx`
- **BREAKING**: 需要在 Supabase 执行迁移 SQL（重命名表、删列、加列）后再部署前端
