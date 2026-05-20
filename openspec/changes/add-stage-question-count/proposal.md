# Change: 关卡题数配置 + 跨关卡题目复用

## Why
当前 CMS 关卡编排有两个限制：
1. **一题一关**：CustomStageEditor 的 `usedByOthers` 过滤把已在其他关卡的题目排除，教师无法把同一道题配置到多个关卡
2. **题数 = 勾选数**：关卡题目数量完全由勾选决定，无法配置"5 道题的素材池里随机出 10 题"的行为

## What Changes
- **BREAKING** `stages` 表新增 `question_count INT` 列，默认 5
- `CustomStage` interface 新增 `questionCount: number`
- CMS CustomStageEditor 去掉 `usedByOthers` 过滤，允许一题多关
- CustomStageEditor 新增题数输入框，校验 `questionCount >= sliceIds.length`
- 客户端 `InteractiveQuiz` 用有放回随机抽样实现"素材池不足时题目重复出现"
- 同步层更新 `syncUpsertStage` / `SupabaseStorageProvider.save` 读写 `question_count`

## Impact
- Affected specs: 新 `stage-management`，修改 `quiz-practice`
- Affected code: `useAppStore.ts`, `CustomStageEditor.tsx`, `InteractiveQuiz.tsx`, `syncOps.ts`, `SupabaseStorageProvider.ts`
- DB migration: `stages` 表加列
