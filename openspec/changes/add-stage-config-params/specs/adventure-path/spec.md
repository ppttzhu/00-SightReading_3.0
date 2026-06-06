## ADDED Requirements

### Requirement: AdventureStage Note Timing Configuration
系统 SHALL 在 `AdventureStage` 数据模型中新增 `noteDisplayMs` 和 `noteHiddenMs` 可选字段，用于控制学生端每个音符的显示和隐藏时间。

#### Scenario: AdventageStage 新字段定义
- **WHEN** `AdventureStage` 在 `useAppStore.ts` 中定义
- **THEN** 该类型 MUST 包含以下可选字段：
  - `noteDisplayMs?: number` — 音符显示时间（毫秒），默认 3000
  - `noteHiddenMs?: number` — 音符隐藏时间（毫秒），默认 6000

#### Scenario: 未设置时默认值兜底
- **WHEN** `getAdventureStages()` 调用，某 AdventureStage 的 `noteDisplayMs` 或 `noteHiddenMs` 为 `undefined`
- **THEN** 返回的 `AutoStage` 中这两个字段 MUST 分别填充为 3000 和 6000

#### Scenario: 教师设置自定义时间
- **WHEN** 教师在 CMS 中为关卡设置 noteDisplayMs=2000, noteHiddenMs=5000
- **THEN** 保存后该配置 MUST 持久化，学生端答题时使用 2000ms 显示 / 5000ms 隐藏

### Requirement: AdventureStage Pass Criteria Configuration
系统 SHALL 在 `AdventureStage` 数据模型中新增 `passCriteria` 可选字段，用于配置通关标准。

#### Scenario: passCriteria 字段定义
- **WHEN** `AdventureStage` 在 `useAppStore.ts` 中定义
- **THEN** 该类型 MUST 包含以下可选字段：
  - `passCriteria?: { enabled: boolean; minAccuracy: number }` — 通关标准配置
  - `enabled` 为 `true` 时启用通关检查
  - `minAccuracy` 为整数（1-100），表示最低正确率百分比

#### Scenario: 未设置通关标准时行为不变
- **WHEN** `passCriteria` 为 `undefined` 或 `passCriteria.enabled === false`
- **THEN** 学生端保持"答完即过"行为，不检查正确率

#### Scenario: 教师设置通关标准
- **WHEN** 教师在 CMS 中为关卡设置 `passCriteria = { enabled: true, minAccuracy: 90 }`
- **THEN** 保存后该配置 MUST 持久化，学生端答题结束时检查正确率是否 ≥90%

### Requirement: CMS Editor Stage Configuration UI
系统 SHALL 在 `StageEditModal`（`AdventureEditor.tsx`）中新增「音符显示时间」和「通关标准」配置区块。

#### Scenario: 音符显示时间配置 UI
- **WHEN** 教师打开编辑关卡弹框
- **THEN** 弹框中 SHALL 显示「音符显示时间」配置区块，包含：
  - 三个预设按钮："快速 (2s)"、"标准 (3s)"、"慢速 (5s)"
  - 一个自定义毫秒输入框（数字，仅接受正整数）
  - 预设按钮选中时自动填充对应值到自定义输入框
  - 默认选中"标准 (3s)"

#### Scenario: 通关标准配置 UI
- **WHEN** 教师打开编辑关卡弹框
- **THEN** 弹框中 SHALL 显示「通关标准」配置区块，包含：
  - 一个启用开关（默认关闭，对应 `enabled: false`）
  - 启用后显示正确率滑块（50%-100%，步长 5%）
  - 滑块旁实时显示当前值（如"90%"）

#### Scenario: 保存关卡配置
- **WHEN** 教师点击"保存修改"
- **THEN** `onSave` 回调 MUST 携带 `noteDisplayMs`、`noteHiddenMs`、`passCriteria` 字段
- **AND** `updateAdventureStage` MUST 将这些字段持久化到 store

#### Scenario: 重新打开弹框时回显已保存配置
- **WHEN** 教师重新打开一个已配置过关卡参数的关卡弹框
- **THEN** 音符显示时间和通关标准的 UI 控件 MUST 回显为已保存的值

#### Scenario: 题数过少时温和提示
- **WHEN** 教师在弹框中启用通关标准，且 `questionCount < 5` 且 `minAccuracy >= 80`
- **THEN** 系统 SHALL 显示提示："当前关卡仅 X 道题，高通关标准可能要求学生必须全对才能通过"

### Requirement: CMS Stage List Config Summary
系统 SHALL 在主线路线列表中直接显示每个关卡的音符显示时间和通关标准摘要，方便教师全局浏览。

#### Scenario: 列表行显示配置标签
- **WHEN** 教师查看右侧"正式主线路线"列表
- **THEN** 每个关卡行 SHALL 显示两个小标签：
  - 音符时间标签：如 `3s`（显示 `noteDisplayMs` 值）
  - 通关标准标签：如 `≥90%`（`passCriteria.enabled === true` 时），或无标签（未启用时）
- **AND** 标签颜色和样式要与现有模块标签风格一致，但不喧宾夺主

### Requirement: AdventureMap Pass Criteria Display
系统 SHALL 在冒险地图关卡卡片上展示通关要求信息。

#### Scenario: 已启用通关标准的关卡
- **WHEN** 冒险地图加载，某关卡 `passCriteria.enabled === true`
- **THEN** 该关卡的锁定状态显示文案为"需 ≥X% 正确率解锁"（X 为 minAccuracy 值）
- **AND** 可闯关/已完成状态的关卡在描述下方显示"需 ≥X% 正确率通关"

#### Scenario: 未启用通关标准的关卡
- **WHEN** 冒险地图加载，某关卡 `passCriteria.enabled === false` 或未设置
- **THEN** 该关卡的锁定状态显示文案保持"等待解锁"

### Requirement: Database Migration — adventure_routes
系统 SHALL 通过数据库迁移在 `adventure_routes` 表中新增对应列。

#### Scenario: 新增列
- **WHEN** 执行数据库迁移 SQL
- **THEN** `adventure_routes` 表 MUST 新增以下列：
  - `note_display_ms INTEGER NOT NULL DEFAULT 3000`
  - `note_hidden_ms INTEGER NOT NULL DEFAULT 6000`
  - `pass_criteria JSONB DEFAULT NULL`

#### Scenario: 向后兼容
- **WHEN** 加载旧数据（不含新列）
- **THEN** 系统 MUST 使用默认值（noteDisplayMs=3000, noteHiddenMs=6000, passCriteria=undefined），不报错

### Requirement: Database Migration — adventure_stage_completions
系统 SHALL 在 `adventure_stage_completions` 表中新增 `passed` 列，用于记录每次尝试是否达标。

#### Scenario: 新增 passed 列
- **WHEN** 执行数据库迁移 SQL
- **THEN** `adventure_stage_completions` 表 MUST 新增以下列：
  - `passed BOOLEAN DEFAULT false`
