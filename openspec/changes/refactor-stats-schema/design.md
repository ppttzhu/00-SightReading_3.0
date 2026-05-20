## Context
`user_type_stats` 按题型（A/B/C/D）汇总，粒度太粗。曲曲需要知道学生具体哪道题错得多，需要 `(user_id, quiz_id)` 粒度的统计表。`practice_records` 的 `slice_type` 与 `module` 重复，`score` 单题无意义，`del_status` 对日志型数据无价值。`student_progress` 的 BIGSERIAL PK 是过度设计，复合 PK `(user_id, module)` 已经是唯一约束。

## Goals / Non-Goals
- Goals: 细粒度统计支持"哪道题错得多"；精简 practice_records；student_progress 用自然 PK；新增闯关排行榜表
- Non-Goals: 不改变答题流程逻辑；不改变 RLS 策略结构；不引入实时推送

## Decisions

### Decision: 只保留 user_slice_stats，不保留 user_type_stats
module 级别统计用 `SELECT module, SUM(...) FROM user_slice_stats JOIN quizzes USING(id) GROUP BY module` 即可，不需要两张表。触发器只维护一张表，更简单。

### Decision: practice_records 去掉 del_status，用 TTL 硬删
日志型数据软删意义不大。30 天 TTL cron 已有，直接硬删。有每日备份兜底。

### Decision: test_success_records PK 为 (user_id, stage_id)
每个学生每个关卡只保留最新一次成功记录（UPSERT）。如果需要历史记录，可以后续加 `attempt_count` 字段，但当前排行榜只需最佳成绩。

### Decision: score 由前端传入，不做后端验证
这是教学工具，不是竞技系统。防作弊成本高于收益。

## Migration Plan
1. 执行 `docs/supabase/migration_stats_schema.sql`
2. 部署前端（Stats.tsx 改用 user_slice_stats）
3. 旧 user_type_stats 数据不迁移（历史统计清零，重新积累）

## Risks / Trade-offs
- 迁移后 user_type_stats 历史数据丢失 → 可接受，统计数据不是业务关键数据
- Stats.tsx 的"题型概览卡片"需要改为从 user_slice_stats JOIN quizzes 聚合 → 查询稍复杂，但数据量小
