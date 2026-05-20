## Context
当前 `stage_quizzes` 的 PK `(stage_id, quiz_id)` 已天然支持跨关卡复用（stage_id 不同即可），真正拦住在前端 `CustomStageEditor` 的 `usedByOthers` Set 过滤。数据库层面无需改动。

`question_count` 的设计动机是：教师可以精选少量高质量题目作为素材池，通过配置更大的 `question_count` 让学生反复练习，而不是被迫录入大量重复性题目。

## Goals / Non-Goals
- Goals: 一题多关、关卡题数可配置、客户端有放回抽样
- Non-Goals: 不支持同一题在同一关卡内多次出现（如需，后续改 PK）；不改变 RLS；不改练习记录统计逻辑

## Decisions

### Decision: 用 `question_count` 而非 `target_count`
`question_count` 更直观——它就是"这关有多少道题"。默认值 5 与现有每关 5 题的默认值对齐。

### Decision: 有放回抽样而非扩增素材池
扩增素材池（比如自动补充同类型同难度的题）需要更复杂的匹配逻辑，且结果不可预测。有放回抽样简单透明，教师明确知道"这 5 题会重复出现"。

### Decision: 校验在 store action 里做，不在 DB 约束
`question_count` 只是业务配置，`sliceIds.length` 是关联数据。用 DB CHECK 约束会把两者耦合，且前端需要友好报错信息。改为前端 + store action 校验。

## Risks / Trade-offs
- `question_count < sliceIds.length` 时学生只会遇到部分题目 → 校验禁止这种情况
- 有放回抽样可能导致同一题连续出现 → 可后续加"不连续重复"优化，当前不加
