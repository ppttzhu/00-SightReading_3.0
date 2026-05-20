## ADDED Requirements

### Requirement: Quiz Table Schema
系统 SHALL 使用 `quizzes` 表（原 `slices`）存储题目素材，表结构 SHALL 包含 `id`、`module`（替代 `type`）、`content`、`difficulty`、`del_status`、`last_updated_by`、`created_at`、`updated_at`，不含 `pitch` 和 `placement` 独立列。

#### Scenario: 题目按 module 查询
- **WHEN** 系统查询某模块的题目
- **THEN** 使用 `SELECT * FROM quizzes WHERE module = 'notes'`，不依赖 `type` 列

#### Scenario: 写入时记录操作人
- **WHEN** admin 执行 INSERT 或 UPDATE
- **THEN** `last_updated_by` 字段存储当前登录用户的 UUID

### Requirement: Stage Quizzes Join Table
系统 SHALL 使用 `stage_quizzes` 表（原 `stage_slices`）维护关卡与题目的多对多关系，表结构 SHALL 包含 `stage_id`、`quiz_id`（原 `slice_id`）、`position`、`del_status`、`last_updated_by`、`created_at`。

#### Scenario: 关卡题目关联写入
- **WHEN** admin 保存关卡题目列表
- **THEN** `stage_quizzes` 中对应行的 `last_updated_by` 更新为当前用户 UUID

### Requirement: Stages Audit Field
`stages` 表 SHALL 包含 `last_updated_by UUID` 字段，每次 INSERT/UPDATE 时由调用方传入当前用户 UUID。

#### Scenario: 关卡创建记录操作人
- **WHEN** admin 创建或修改关卡
- **THEN** `stages.last_updated_by` 存储该 admin 的 UUID

### Requirement: Frontend Module Field
前端 `Slice` interface SHALL 使用 `module: 'notes' | 'symbols' | 'theory' | 'patterns'` 替代 `type: 'A' | 'B' | 'C' | 'D'`，所有 `TYPE_TO_MODULE` 映射层 SHALL 删除。

#### Scenario: InteractiveQuiz 按 module 分支
- **WHEN** `InteractiveQuiz` 渲染题目
- **THEN** 使用 `switch(slice.module)` 分支，case 值为 `'notes'`/`'symbols'`/`'theory'`/`'patterns'`

#### Scenario: 重复题目检测
- **WHEN** `areSlicesDuplicate` 比较两道题
- **THEN** 使用 `slice.module === 'notes'` 判断是否为单音题，不使用 `slice.type === 'A'`

### Requirement: Auth SQL Record
`docs/supabase/auth.sql` SHALL 作为独立文件保留，记录 `profiles` 表、`app_role` enum、触发器和 RLS 策略的建表 SQL，不得删除。

#### Scenario: auth.sql 文件存在
- **WHEN** 开发者查看 `docs/supabase/` 目录
- **THEN** `auth.sql` 文件存在且包含完整的 profiles/role/trigger/RLS 建表语句
