## 1. SQL 迁移
- [ ] 1.1 编写 `docs/supabase/migration_stats_schema.sql`：删 `user_type_stats`、建 `user_slice_stats`（PK: user_id+quiz_id）、改 `practice_records`（删 slice_type/score/del_status，slice_id→quiz_id）、改 `student_progress`（删 id/del_status，PK→user_id+module）、建 `test_success_records`、重建触发器

## 2. Store & Types
- [ ] 2.1 `useAppStore.ts`：`UserTypeStats` 改为 `UserQuizStats`（`sliceType` → `quizId`）；`PracticeRecord` 删 `sliceType`/`score`；`syncUpsertStudentProgress` 的 upsert payload 去掉 `del_status`
- [ ] 2.2 `useAppStore.ts`：`fetchUserTypeStats` → `fetchUserQuizStats`；`fetchAllUserTypeStats` → `fetchAllUserQuizStats`；查询表名改为 `user_slice_stats`，字段 `slice_type` → `quiz_id`
- [ ] 2.3 `useAppStore.ts`：`fetchPracticeRecords`/`fetchStudentPracticeRecords` 去掉 `del_status` 过滤，字段映射删 `sliceType`/`score`，`slice_id` → `quiz_id`

## 3. syncOps
- [ ] 3.1 `syncOps.ts`：`syncRecordPractice` 参数删 `sliceType`/`score`，`sliceId` → `quizId`；row 字段同步更新，去掉 `del_status`
- [ ] 3.2 `syncOps.ts`：`syncUpsertStudentProgress` 去掉 `del_status: false`
- [ ] 3.3 `syncOps.ts`：新增 `syncRecordTestSuccess(params)` 函数，UPSERT `test_success_records`

## 4. Stats.tsx
- [ ] 4.1 `Stats.tsx`：`UserTypeStats` → `UserQuizStats`，`sliceType` → `quizId`；题型概览卡片改为按 module 聚合（需 JOIN quizzes 或前端 map）
- [ ] 4.2 `Stats.tsx`：详情弹窗表格删"类型"列（已有模块列），删"分数"列

## 5. Verification
- [ ] 5.1 `npx tsc -b` 通过
- [ ] 5.2 `npx vitest run` 全部通过
- [ ] 5.3 `openspec validate refactor-stats-schema --strict` 通过
