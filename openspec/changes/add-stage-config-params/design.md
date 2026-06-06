## Context
闯关模式中，教师需要精细控制每个关卡的练习参数。当前系统硬编码了音符闪烁时间（3s 显示 / 6s 隐藏）并且没有通关门槛。

## Goals / Non-Goals
### Goals
- 教师可在 CMS 编辑关卡时为每个关卡独立配置音符显示时间和通关标准
- 学生端答题时使用关卡配置的显示时间
- 答题结束后按通关标准判定是否达标，达标才记录通关
- 失败时展示结算界面，提供重试入口
- 所有新增字段向后兼容，不破坏现有数据

### Non-Goals
- 不实现自适应速度算法（根据正确率自动调整时间）
- 不实现跳过/降级通关机制
- 不实现全局统一的显示时间设置（优先关卡级别配置）

## Decisions

### Decision 1: 数据模型设计
- `noteDisplayMs` 和 `noteHiddenMs` 分离存储（非单一"速度"字段），便于未来控制不同的闪烁模式
- `passCriteria` 使用对象结构 `{ enabled: boolean; minAccuracy: number }`，便于未来扩展（如 `maxAttempts`, `minQuestions`）
- 所有字段可选，`getAdventureStages()` 返回时填充默认值（3000/6000/enabled=false）

### Decision 2: 配置 UI 设计
- 音符显示时间使用预设按钮（快速 2s / 标准 3s / 慢速 5s）+ 自定义毫秒输入
- 通关标准使用开关 + 滑块（50%-100%）或数字输入
- 放在弹框中的折叠面板「关卡参数」内，与内容编辑区分离

### Decision 3: 进行中学生处理策略
- 学生开始答题时，将 stage 配置快照到 `useState`（使用 `() =>` 初始化）
- 整个答题过程使用快照值，教师中途修改不影响已开始的学生
- 下次重试时自动使用新配置

### Decision 4: 未达标时行为 — 始终调用 completeAdventureStage
- 无论是否达标，始终调用 `completeAdventureStage(stageId, { ..., passed: boolean })`
- `completeAdventureStage` 内部：
  - 始终调用 `syncRecordAdventureCompletion`（记录每一次尝试到 DB）
  - 只在 `passed=true` 时加入 `adventureCompletedStageIds`（解锁下一关）
  - `passed=false` 时不解锁，但尝试记录入库
- 显示结算弹框，提供「重试」和「返回地图」两个按钮
- 这样做到"未达标记录可追溯、可重试、不卡死"

### Decision 5: SupabaseStorageProvider 必须同步修改
- `save()` 的 `rows.map()` 必须包含 `note_display_ms`、`note_hidden_ms`、`pass_criteria`
- `load()` 的 `routeRows.map()` 必须读取这三列
- 否则 publish 后数据丢失。这个映射是**必经之路**，必须在 CMS 编辑器和学生端之前完成。

## Alternatives Considered

### 音符显示时间全局设置
- **方案**：在 CMS 设置页面配置全局统一时间
- **反对**：不同难度关卡需要不同的时间，关卡级别更灵活

### 通关标准使用单一数字字段而非对象
- **方案**：`passRate?: number` 可选，有值则启用，无值则不启用
- **反对**：语义不清晰，`enabled` 开关明确了"是否启用"的意图，且未来扩展需要改类型

### 实时同步配置
- **方案**：每次翻题时重新读取远端配置
- **反对**：学生答题过程中配置变化体验极差

## Risks / Trade-offs
- **风险**：如果教师对所有关卡都设置了高通过率（如 100%），学生可能卡关 → **缓解**：在产品层面建议第一关不设严格标准
- **风险**：音符时间设置不当（太快）可能导致学生挫败 → **缓解**：提供预设值并显示效果说明
- **迁移风险**：现有已发布路线没有新字段 → **缓解**：getAdventureStages 中填充默认值

## Migration Plan
1. 先部署数据库迁移 SQL（新增列，允许 NULL）
2. 部署前端代码（新字段可选，代码有默认值保护）
3. 管理员手动编辑关卡时新字段开始生效

## Open Questions
- 结算界面是否需要展示具体的错题列表（目前 MVP 只展示正确率）？
- 需要针对"通过率过高"（如 >=95%）给教师弹提示吗？

## Recently Added Decisions (round 2)

### Decision 6: CMS 主线列表展示配置摘要
在右侧"正式主线路线"的每个关卡行中，紧随标题行显示两个小标签：
- `3s` 风格标签（浅紫色背景，音符图标）
- `≥90%` 风格标签（浅橙色背景，靶心图标）
与现有的模块标签并列，不额外占行。

### Decision 7: 冒险地图展示尝试信息
- 冒险地图从 `adventure_stage_completions` 加载每个关卡的尝试次数和最高分
- 数据在 `useAppStore` 中新增 `stageAttemptStats: Record<string, { attemptCount: number; bestScore: number }>`
- 加载时机：进入冒险地图时统一加载，避免每个卡片单独请求
- 未通过关卡显示"已试 X 次 · 最高 Y%"，按钮文案改为"继续挑战"
- 已通关关卡显示"最高正确率 Y%"

### Decision 8: 题数过少提示规则
- 触发条件：`questionCount < 5` 且 `minAccuracy >= 80` 且 `enabled === true`
- 提示为轻量级 inline 文案（非弹框），不影响保存
