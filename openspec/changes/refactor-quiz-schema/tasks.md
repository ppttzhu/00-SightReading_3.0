## 1. SQL 迁移
- [x] 1.1 恢复 `docs/supabase/auth.sql`（从 git 历史 cherry-pick）
- [x] 1.2 编写 `docs/supabase/migration_quiz_schema.sql`：重命名 `slices→quizzes`、`stage_slices→stage_quizzes`、删 `pitch`/`placement`/`type` 列、加 `module`/`last_updated_by` 列、重建索引和触发器

## 2. 存储层
- [x] 2.1 `SupabaseStorageProvider.ts`：`SliceRow` 去掉 `pitch`/`placement`/`type`，加 `module`；表名改 `quizzes`/`stage_quizzes`；`slice_id` 改 `quiz_id`
- [x] 2.2 `syncOps.ts`：`SliceRow` 同步更新；删 `TYPE_TO_MODULE`；表名改；`sliceToRow` 去掉 pitch/placement 逻辑

## 3. Store & Types
- [x] 3.1 `useAppStore.ts`：`Slice.type` 改为 `Slice.module`；删 `TYPE_TO_MODULE`；`autoGenerateStages` 按 module 分组；`areSlicesDuplicate` 用 `module === 'notes'`
- [x] 3.2 `syncOps.ts`：`syncRecordPractice` 参数 `sliceType` 改为 `module`（直接传，不再映射）

## 4. Engine
- [x] 4.1 `Extractors.ts`：`Slice` type 字段改为 `module`；mock 数据更新

## 5. CMS 组件
- [x] 5.1 `ManualCreator.tsx`：`type` state 改为 `module`，值从 `'A'` 改为 `'notes'` 等
- [x] 5.2 `StageBuilder.tsx`：`TYPE_LABELS`/`TYPE_COLORS` 改为 `MODULE_LABELS`/`MODULE_COLORS`，key 改为 module 名
- [x] 5.3 `CustomStageEditor.tsx`：同上，`slice.type` 改为 `slice.module`

## 6. Client 组件
- [x] 6.1 `InteractiveQuiz.tsx`：`switch(slice.type)` 改为 `switch(slice.module)`，case 值改为模块名；`sliceType` 参数改为 `module`

## 7. Tests
- [x] 7.1 `useAppStore.test.ts`：mock slice 的 `type: 'A'` 改为 `module: 'notes'`，`type: 'B'/'C'/'D'` 同步更新

## 8. Verification
- [x] 8.1 `npx tsc -b` 通过
- [x] 8.2 `npx vitest run` 全部通过（114 tests）
- [x] 8.3 `openspec validate refactor-quiz-schema --strict` 通过
