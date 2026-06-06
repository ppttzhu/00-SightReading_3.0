## 1. AdventureStage 类型增强
- [x] 1.1 在 `useAppStore.ts` 中新增 `AdventureStage.noteDisplayMs`、`AdventureStage.noteHiddenMs` 可选字段
- [x] 1.2 在 `useAppStore.ts` 中新增 `AdventureStage.passCriteria` 可选字段，类型 `{ enabled: boolean; minAccuracy: number }`
- [x] 1.3 在 `getAdventureStages()` 中为未设置字段填充默认值（3000/6000/enabled=false）

## 2. 数据库迁移 + 同步层映射（必须先做）
- [x] 2.1 编写 SQL：`adventure_routes` 表新增 `note_display_ms`、`note_hidden_ms`、`pass_criteria` 列
- [x] 2.2 编写 SQL：`adventure_stage_completions` 表新增 `passed` 列
- [x] 2.3 更新 `SupabaseStorageProvider.save()` — `rows.map` 包含新三列
- [x] 2.4 更新 `SupabaseStorageProvider.load()` — 读取新三列到 AdventureStage
- [x] 2.5 更新 `syncOps.ts` 中 `syncRecordAdventureCompletion` 写入 `passed` 状态
- [ ] 2.6 确认 Supabase 迁移能正确应用（手动在 Supabase Dashboard SQL Editor 执行）

## 3. CMS 编辑器 — 编辑关卡弹框增强（可与 4/5 并行）
- [x] 3.1 在 `StageEditModal` 中添加「音符显示时间」配置区块（预设按钮 + 自定义毫秒输入）
- [x] 3.2 在 `StageEditModal` 中添加「通关标准」配置区块（启用开关 + 正确率滑块）
- [x] 3.3 题数过少时显示温和提示（questionCount < 5 且 minAccuracy >= 80）
- [x] 3.4 更新 `StageEditModal` 的 `onSave` 回调签名，包含新字段
- [x] 3.5 更新 `updateAdventureStage` 调用，传递新字段
- [x] 3.6 主线路线列表每行显示配置标签（`3s`、`≥90%` 等）

## 4. 学生端 — InteractiveQuiz 适配（可与 3 并行）
- [x] 4.1 从 store 的 `adventureStages` 读取 `noteDisplayMs`/`noteHiddenMs`，通过快照传递给 `useBlinkTimer`
- [x] 4.2 修改 `completeAdventureStage` 逻辑：始终调用，`passed` 为 true 时加解锁，false 时不加
- [x] 4.3 答题结束时增加通关判定逻辑（检查 passCriteria）
- [x] 4.4 未达标时显示结算 UI（正确率 vs 要求，本次用时，重试/查看学习指导/返回地图按钮）
- [x] 4.5 重试时需更新 `sessionKey` 触发题目重新 shuffle 和状态重置

## 5. 学生端 — AdventureMap 适配（可与 3/4 并行）
- [x] 5.1 锁定关卡卡片上显示通关要求文案（如"需 ≥90% 正确率"）
- [x] 5.2 可闯关/已完成关卡显示当前通关要求
- [x] 5.3 加载 `adventure_stage_completions` 数据，未通过关卡显示"已试 X 次 · 最高 Y%"，按钮文案"继续挑战"
- [x] 5.4 已通关关卡显示"最高正确率 Y%"

## 6. 测试
- [ ] 6.1 验证未设置通关标准时行为不变（答完即过）
- [ ] 6.2 验证设置通关标准后未达标时不通关、显示结算
- [ ] 6.3 验证设置通关标准后达标时正常通关
- [ ] 6.4 验证不同音符显示时间在答题中生效
- [ ] 6.5 验证向后兼容：旧数据加载后默认值正确
- [ ] 6.6 验证 publish → load 全链路不丢失配置
