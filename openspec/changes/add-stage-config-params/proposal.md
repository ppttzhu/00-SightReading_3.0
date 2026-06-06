# Change: Add adventure stage configuration parameters (note timing + pass criteria)

## Why
教师在闯关模式中需要为每个关卡单独配置音符显示时间和通关标准，以实现差异化的教学策略和难度控制。目前音符显示时间硬编码为 3s/6s，通关答完即过，缺乏教学灵活性。

## What Changes

### 1. AdventureStage 数据模型增强
- 新增 `noteDisplayMs` 和 `noteHiddenMs` 字段（音符闪烁时间，毫秒，可选，向后兼容）
- 新增 `passCriteria` 字段（通关标准，可选对象，含 `enabled` 和 `minAccuracy`）

### 2. CMS 编辑器增强 — AdventureEditor.tsx
- `StageEditModal` 新增「音符显示时间」配置项（预设值：快速/标准/慢速，或自定义毫秒数）
- `StageEditModal` 新增「通关标准」配置项（启用开关 + 正确率滑块/输入）

### 3. 学生端答题 — InteractiveQuiz.tsx
- `useBlinkTimer` 参数改为从 stage 配置读取，替代硬编码 3000/6000
- 冒险关卡完成时增加通关判定：若启用 passCriteria 且正确率未达标，显示结算界面，不调用 `completeAdventureStage`
- 新增结算 UI 组件 `StageResultModal`：展示正确率、要求、用时，达标自动通关，未达标提供重试

### 4. 学生端冒险地图 — AdventureMap.tsx
- 锁定关卡卡片上显示通关要求（如"需 ≥90% 正确率"）

### 5. 数据库 & 同步
- `adventure_routes` 表新增 `note_display_ms`、`note_hidden_ms`、`pass_criteria` 列
- `syncOps.ts` 中 `syncRecordAdventureCompletion` 写入 `passed` 状态

## Impact
- Affected specs: adventure-path, quiz-practice
- Affected code:
  - `src/core/store/useAppStore.ts` — AdventureStage 类型增强
  - `src/pages/cms/AdventureEditor.tsx` — StageEditModal 新增配置项
  - `src/pages/client/InteractiveQuiz.tsx` — 时间读取 + 通关判定 + 结算 UI
  - `src/pages/client/AdventureMap.tsx` — 显示通关要求
  - `src/core/storage/syncOps.ts` — 写入 passed 状态
  - `src/hooks/useBlinkTimer.ts` — 无需修改（已依赖 showMs/hideMs 变化自动重置）
  - 数据库迁移 SQL — 新增列
