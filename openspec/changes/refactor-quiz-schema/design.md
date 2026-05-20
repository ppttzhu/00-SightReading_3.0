## Context
题库存储层当前有两套并行的类型系统：`type (A/B/C/D)` 用于前端逻辑，`module (notes/symbols/theory/patterns)` 用于关卡和进度。`syncOps.ts:261` 的 `TYPE_TO_MODULE` 映射是这个双轨制的直接证据。`pitch`/`placement` 作为独立列存在，但实际值已经在 `content` JSONB 里重复存储（`Extractors.ts:150`）。

## Goals / Non-Goals
- Goals: 统一用 `module` 作为唯一类型标识；删除冗余列；表名语义化；加审计字段
- Non-Goals: 不改变题目内容结构（`content` JSONB 内部格式不变）；不改变关卡逻辑；不改变 RLS 策略

## Decisions

### Decision: 删除 pitch/placement 列而非保留
pitch/placement 的唯一用途是 `idx_slices_pitch_placement` 索引（按音高筛选 A 类题）。该索引只在 CMS 题库浏览时有价值，频率极低。`content->>'pitch'` 的 GIN 索引可以替代，但考虑到数据量（几百道题），全表扫描也可接受。
- **Alternatives considered**: 保留列但标记 deprecated → 增加维护负担，不如直接删

### Decision: Slice.type → Slice.module（前端类型同步改）
前端 `Slice` interface 的 `type: 'A'|'B'|'C'|'D'` 改为 `module: 'notes'|'symbols'|'theory'|'patterns'`。`InteractiveQuiz.tsx` 里的 `switch(slice.type)` 改为 `switch(slice.module)`，case 值从字母改为模块名。
- **Alternatives considered**: 保留前端 type 字段，只改 DB 列 → 仍需维护映射层，不彻底

### Decision: last_updated_by 由调用方传入，不用触发器
触发器方案需要 `auth.uid()` 在 DB session 里可用（Supabase RLS 环境下可以），但前端已经有 session，直接在 upsert payload 里传 `last_updated_by: session.user.id` 更简单透明。

## Migration Plan
1. 执行 `docs/supabase/migration_quiz_schema.sql`（重命名表、删列、加列、重建索引和触发器）
2. 部署前端（新代码引用 `quizzes`/`stage_quizzes`，字段用 `module`）
3. 步骤 1 和 2 必须原子完成（维护窗口），否则旧前端写 `slices` 表会 404

## Risks / Trade-offs
- 迁移期间服务不可用（需要维护窗口）
- `areSlicesDuplicate` 测试用 `type: 'A'` → 改为 `module: 'notes'`，需同步更新测试
- `useAppStore.test.ts` 里的 mock slice 需要更新
