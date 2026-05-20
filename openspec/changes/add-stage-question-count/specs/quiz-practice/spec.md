## MODIFIED Requirements

### Requirement: Stage Question Sampling
客户端在闯关模式 SHALL 根据关卡的 `questionCount` 决定题目数量。若 `questionCount` 大于关卡实际关联的题目数，SHALL 使用有放回随机抽样（题目可重复出现）。

#### Scenario: 素材池足够
- **WHEN** 关卡关联 10 题，`questionCount = 10`
- **THEN** 客户端展示全部 10 题，随机排序，每题只出现一次

#### Scenario: 素材池不足，题目重复出现
- **WHEN** 关卡关联 5 题，`questionCount = 10`
- **THEN** 客户端从 5 题中有放回随机抽取 10 次
- **AND** 同一题可能多次出现
- **AND** 每道抽中的题都参与正确率统计和答题记录

#### Scenario: 关卡无配置使用默认值
- **WHEN** 关卡没有 `questionCount`（旧数据）
- **THEN** 客户端使用默认值 5
- **AND** 若关卡关联题目数 >= 5，展示 5 题；若不足 5，有放回抽样补足
