## 1. Database
- [x] 1.1 `docs/supabase/migration_add_question_count.sql`：为 `stages` 表添加 `question_count INT NOT NULL DEFAULT 5`

## 2. Store & Types
- [x] 2.1 `useAppStore.ts`：`CustomStage` interface 加 `questionCount: number`；`updateCustomStage` patch 类型加 `questionCount`
- [x] 2.2 `useAppStore.ts`：`AutoStage` 加 `questionCount`；`getAllStages` 返回 `questionCount`；删除 fallback 路径的 `usedInCustom` 过滤；`autoGenerateStages` 加 `questionCount = batch.length`

## 3. CMS Editor
- [x] 3.1 `CustomStageEditor.tsx`：去掉 `usedByOthers` 过滤逻辑
- [x] 3.2 `CustomStageEditor.tsx`：新增题数输入框（number input，`min={selectedIds.size}`），保存时校验，超出素材池时显示"（会重复）"提示
- [x] 3.3 `CustomStageEditor.tsx`：编辑模式下加载并显示已有 `questionCount`

## 4. Client Quiz
- [x] 4.1 `InteractiveQuiz.tsx`：根据 `stage.questionCount` 有放回随机抽样生成题目列表

## 5. Storage Layer
- [x] 5.1 `syncOps.ts`：`StageRow` 加 `question_count`；`stageToRow` 写入该字段
- [x] 5.2 `SupabaseStorageProvider.ts`：`StageRow` 加 `question_count`；`save` 写入；`load` 读取并映射到 `questionCount`；`select` 语句加 `question_count`

## 6. Verification
- [x] 6.1 `npx tsc -b` 通过
- [x] 6.2 `npx vitest run` 全部通过（114 tests）
- [x] 6.3 `openspec validate add-stage-question-count --strict` 通过
