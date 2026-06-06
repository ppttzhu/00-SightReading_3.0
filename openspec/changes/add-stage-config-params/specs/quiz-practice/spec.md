## MODIFIED Requirements

### Requirement: 冒险关卡使用配置的音符显示时间
系统 SHALL 在 `InteractiveQuiz` 中从冒险关卡配置读取音符闪烁时间，替代硬编码值。

#### Scenario: 冒险关卡从配置读取显示时间
- **WHEN** 学生通过 `/client/adventure/quiz/:stageId` 进入答题，且该关卡设置了自定义 `noteDisplayMs`/`noteHiddenMs`
- **THEN** `useBlinkTimer` MUST 使用 `stage.noteDisplayMs` 和 `stage.noteHiddenMs` 作为参数
- **AND** 音符显示/隐藏周期 MUST 按照配置的时间执行

#### Scenario: 非冒险关卡保持默认时间
- **WHEN** 学生进入自由练习或常规模块答题（非冒险模式）
- **THEN** `useBlinkTimer` MUST 继续使用 3000/6000 默认值，行为不变

#### Scenario: 配置变化不影响进行中的答题
- **WHEN** 学生在答题过程中教师修改了该关卡的音符显示时间
- **THEN** 当前答题 session 不受影响，使用答题开始时的快照值

### Requirement: 冒险关卡通关标准判定
系统 SHALL 在冒险关卡答题结束时根据通关标准判定是否达标。**无论是否达标，系统始终调用 `completeAdventureStage`，但只在达标时更新 `adventureCompletedStageIds`（解锁下一关）。** 未达标时显示结算界面。

#### Scenario: 达标时正常通关
- **WHEN** 学生完成所有题目，且 `correctCount / total >= passCriteria.minAccuracy`
- **THEN** 系统 MUST 调用 `completeAdventureStage(stage.id, { correctCount, wrongCount, timeSpentSec, passed: true })`
- **AND** `adventureCompletedStageIds` MUST 包含该 stageId（下一关解锁）
- **AND** 导航回冒险地图，关卡标记为已完成

#### Scenario: 未达标时通关失败
- **WHEN** 学生完成所有题目，且 `correctCount / total < passCriteria.minAccuracy`
- **THEN** 系统 MUST 调用 `completeAdventureStage(stage.id, { correctCount, wrongCount, timeSpentSec, passed: false })`
- **AND** `adventureCompletedStageIds` MUST NOT 包含该 stageId（不解锁）
- **AND** SHALL 显示结算界面 `StageResultModal`

#### Scenario: 未启用通关标准时直接通过
- **WHEN** 学生完成所有题目，且 `passCriteria.enabled === false` 或未设置
- **THEN** 系统 MUST 保持现有行为：调用 `completeAdventureStage`（passed=true），加入 `adventureCompletedStageIds`，导航回地图

#### Scenario: 上一关未通关不影响本关的显示时间读取
- **WHEN** 学生进入某个冒险关卡
- **THEN** 该关卡的音符显示时间 MUST 始终使用该关卡自身的配置，不受通关状态影响

### Requirement: StageResultModal 结算界面
系统 SHALL 在冒险关卡未达标时展示 `StageResultModal` 结算界面。

#### Scenario: 未达标结算展示
- **WHEN** 学生未通过冒险关卡的通关标准检查
- **THEN** 弹框 SHALL 显示以下信息：
  - 本关正确率（如"75%"）
  - 通关要求（如"需 ≥90%"）
  - 本次答题用时
  - 该关卡历史已尝试次数和最高正确率（从 `adventure_stage_completions` 加载）
  - "未达标"提示
  - "重试"按钮 — 点击后重新开始本关答题
  - "查看学习指导"按钮 — 点击打开 GuidanceModal，查看本关卡学习指导
  - "返回地图"按钮 — 点击后导航回 `/client/adventure`

#### Scenario: 重试重置状态
- **WHEN** 学生在结算界面点击"重试"
- **THEN** 系统 MUST 重置所有答题状态：
  - `currentSliceIndex` 重置为 0
  - `correctCountRef` 和 `wrongCountRef` 重置为 0
  - 题目重新 shuffle
  - 计时重新开始
- **AND** 音符显示时间仍使用该关卡配置（快照值不变）

### Requirement: 冒险地图失败状态展示
系统 SHALL 在冒险地图关卡卡片上展示学生的尝试记录，让学生了解自己的进展。

#### Scenario: 未通过关卡展示尝试信息
- **WHEN** 冒险地图加载，某关卡 `passCriteria.enabled === true` 且该关卡有 `adventure_stage_completions` 记录但不在 `adventureCompletedStageIds` 中
- **THEN** 该关卡卡片 SHALL 在描述下方显示"已试 X 次 · 最高 Y%"（X 为 attempt_count，Y 为最高 score）
- **AND** 该关卡的按钮文案显示为"继续挑战"而非"闯关"

#### Scenario: 已通关关卡展示通过信息
- **WHEN** 冒险地图加载，某关卡在 `adventureCompletedStageIds` 中且启用了通关标准
- **THEN** 该关卡卡片 SHALL 在描述下方显示"最高正确率 Y%"

### Requirement: SupabaseStorageProvider 数据映射
系统 SHALL 在 `SupabaseStorageProvider.save()` 中将新字段写入 `adventure_routes` 表，在 `SupabaseStorageProvider.load()` 中从数据库读取新字段到 `AdventureStage`。

#### Scenario: save() 写入新字段
- **WHEN** `SupabaseStorageProvider.save()` 被调用，`AdventureStage` 包含新字段
- **THEN** 写入 `adventure_routes` 表的行 MUST 包含 `note_display_ms`、`note_hidden_ms`、`pass_criteria` 三列

#### Scenario: load() 读取新字段
- **WHEN** `SupabaseStorageProvider.load()` 被调用，`adventure_routes` 表中有新列数据
- **THEN** 返回的 `AdventureStage` MUST 包含 `noteDisplayMs`、`noteHiddenMs`、`passCriteria` 字段

#### Scenario: 旧数据无新列时不报错
- **WHEN** `adventure_routes` 表存在但新列为 NULL
- **THEN** `load()` 返回的 `AdventureStage` 中对应字段 MUST 为 `undefined`（store 层兜底默认值）
