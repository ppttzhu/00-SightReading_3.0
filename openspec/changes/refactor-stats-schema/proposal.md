# Change: 统计体系 Schema 重构

## Why
`user_type_stats` 只能按题型（A/B/C/D）汇总，无法定位学生具体在哪道题上反复出错（曲曲需求）。`practice_records` 含冗余字段（`slice_type`、`score`、`del_status`），`student_progress` 用 BIGSERIAL 做 PK 而非复合 PK，`test_success_records` 表缺失导致闯关排行榜无处存储。

## What Changes
- **BREAKING** `user_type_stats` 替换为 `user_slice_stats`，PK 从 `(user_id, slice_type)` 改为 `(user_id, quiz_id)`
- **BREAKING** `practice_records` 删除 `slice_type`、`score`、`del_status` 列
- **BREAKING** `student_progress` PK 从 `id BIGSERIAL` 改为 `(user_id, module)`，删除 `id` 和 `del_status` 列
- 新增 `test_success_records` 表（闯关排行榜）
- 触发器从维护 `user_type_stats` 改为维护 `user_slice_stats`
- `useAppStore`、`syncOps`、`Stats.tsx` 同步更新

## Impact
- Affected specs: 修改 `student-stats`（已在 `add-cms-student-stats` 中定义）
- Affected code: `docs/supabase/sightreading.sql`、`src/core/store/useAppStore.ts`、`src/core/storage/syncOps.ts`、`src/pages/cms/Stats.tsx`
- **BREAKING**: 需要迁移 SQL + 前端同步部署
