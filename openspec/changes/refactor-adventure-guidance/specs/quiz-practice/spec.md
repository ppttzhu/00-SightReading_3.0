## MODIFIED Requirements

### Requirement: Stage Guidance Resolution in InteractiveQuiz
系统 SHALL 在 `InteractiveQuiz` 中正确解析冒险关卡的学习指导。当前 `customStages.find(cs => cs.id === stageId)` 无法匹配 `adventure_route_xxx` ID。改造后 SHALL 根据 ID 前缀选择不同的查找路径。

#### Scenario: 冒险关卡 ID 前缀检测
- **WHEN** `stageId` 以 `adventure_route_` 开头
- **THEN** 系统 MUST 调用 `getAdventureStages()` 匹配 `stageId`
- **AND** 从匹配到的 `AutoStage` 读取 `guidance` 和 `guidanceImages`
- **AND** 渲染 guidance 时将 `{image:<id>}` 占位符替换为图片表的 `<img>` 标签
- **AND** MUST 同时兼容旧 `![alt](url)` 格式的直接渲染

#### Scenario: 弹框触发条件修复
- **WHEN** 系统判断是否显示 GuidanceModal
- **THEN** `stageRecord` 对冒险关卡 MUST 从 `getAdventureStages()` 获取
- **AND** 对非冒险关卡 MUST 从 `customStages` 获取
- **AND** 弹框的 title 参数 MUST 使用对应来源的 title

#### Scenario: 所有关卡每次进入都弹
- **WHEN** 学生进入任何一个有非空 `guidance` 的关卡（冒险或自由练习）
- **THEN** 系统 MUST 弹 GuidanceModal
- **AND** MUST NOT 提供"不再提示"选项
- **AND** MUST NOT 检查任何 localStorage suppression 记录
- **AND** 学生点击"开始答题"后关闭弹框进入答题
- **WHEN** 学生退出后再次进入同一关卡
- **THEN** 弹框 MUST 再次弹出

## REMOVED Requirements

### Requirement: Suppression with localStorage
**Reason**: 需求改为每次都弹指导，不再需要 suppression 机制。

**Migration**: 
- 移除 `GUIDANCE_SUPPRESS_KEY` 常量
- 移除 `readSuppressedMap()` 和 `writeSuppressed()` 辅助函数
- 移除 `introDismissed` 中读取 localStorage 判断是否 suppression 的逻辑
- 使用简单的布尔值 state 控制弹框显示
