## ADDED Requirements

### Requirement: Stage Question Count Configuration
系统 SHALL 允许教师为每个关卡配置 `question_count`（关卡题目数量），其值 SHALL 大于等于该关卡已关联的题目数（`sliceIds.length`），默认值为 5。

#### Scenario: 创建关卡时配置题数
- **WHEN** 教师在 CustomStageEditor 创建关卡并选择了 3 道题目
- **THEN** 题数输入框默认显示 5
- **AND** 教师可将其改为 3 或更大的数字（如 10）
- **AND** 保存时若 `questionCount < sliceIds.length`，系统提示"题数不能小于已选题目数"

#### Scenario: 修改关卡题数
- **WHEN** 教师编辑已有关卡，该关卡已关联 5 题
- **THEN** 题数输入框显示当前配置的 `questionCount`
- **AND** 教师可将其增大到 10，但不能减小到 4（小于 5）

### Requirement: Cross-Stage Question Reuse
系统 SHALL 允许同一道题出现在多个不同关卡中。CMS 题库列表 SHALL 显示全部题目，不隐藏已被其他关卡引用的题目。

#### Scenario: 同一题配置到多个关卡
- **WHEN** 题目 "C4" 已在"单音第一关"
- **THEN** 教师在"单音第二关"的题库列表中仍能看到 "C4"
- **AND** 教师可勾选 "C4" 并将其加入"单音第二关"
- **AND** 保存后两个关卡都包含 "C4"

#### Scenario: 关卡编辑时不移除其他关卡的引用
- **WHEN** 教师编辑"单音第一关"并删除 "C4"
- **THEN** "单音第二关"的 "C4" 不受影响

## MODIFIED Requirements

### Requirement: Stage Data Model
`CustomStage` interface SHALL 包含 `questionCount: number`，默认值为 5。`stages` 表 SHALL 包含 `question_count INT NOT NULL DEFAULT 5` 列。

#### Scenario: 加载旧数据兼容
- **WHEN** 加载没有 `questionCount` 字段的旧关卡数据
- **THEN** 默认使用 5 作为 `questionCount`

#### Scenario: 数据库持久化
- **WHEN** admin 保存关卡
- **THEN** `stages.question_count` 与 `sliceIds.length` 一同写入
