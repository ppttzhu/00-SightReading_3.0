## 1. 数据模型 + Store（Change 1）
- [ ] 1.1 在 `useAppStore.ts` 中定义 `AdventureStage`、`QuizModuleId` 类型
- [ ] 1.2 在 `useAppStore.ts` state 中新增 `adventureStages: AdventureStage[]`
- [ ] 1.3 在 `useAppStore.ts` state 中新增 `adventureCompletedStageIds: string[]`
- [ ] 1.4 实现 store actions：`setAdventureStages`、`addAdventureStage`、`removeAdventureStage`、`moveAdventureStage`、`completeAdventureStage`（含 `orderAdventureStages` 排序辅助函数）
- [ ] 1.5 实现 `getAdventureStages` selector（解析 `sourceStageId` → `customStages` → 返回 `AutoStage[]`）
- [ ] 1.6 在 `StageData` 类型中新增 `adventureStages?: AdventureStage[]`
- [ ] 1.7 更新 `useRemoteSync.ts` publish 函数附带 `adventureStages`
- [ ] 1.8 实现删除 `CustomStage` 时的引用检测：检查是否有 `AdventureStage.sourceStageId` 指向它，有则阻止并提示

## 2. 数据库持久化（Change 1）
- [ ] 2.1 创建数据库迁移 SQL：`adventure_paths` 表（UUID PK + stages JSONB + timestamps）
- [ ] 2.2 实现 `SupabaseStorageProvider` 的冒险路线加载逻辑：优先查 `adventure_paths` 表，回退到 `StageData.adventureStages`
- [ ] 2.3 实现 `SupabaseStorageProvider` 的冒险路线保存逻辑：写入 `adventure_paths` 表
- [ ] 2.4 更新 `CloudflareStorageProvider` 支持新的 `StageData.adventureStages` 字段

## 3. 教师端 AdventurerEditor（Change 1）
- [ ] 3.1 创建 `AdventureEditor.tsx` 组件
- [ ] 3.2 实现手动排关模式：左侧现有关卡库 → 右侧正式主线路线
- [ ] 3.3 实现模块筛选（all/notes/theory/symbols/patterns）
- [ ] 3.4 实现关卡搜索
- [ ] 3.5 实现"加入主线"、"移出路线"、"上移/下移"功能
- [ ] 3.6 实现保存路线按钮（只写入 store，持久化依赖 CMS Publish）
- [ ] 3.7 实现引用有效性检查：被引用关卡是否存在、是否有 slice
- [ ] 3.8 在 `CMSLayout.tsx` 侧边栏新增"主线编排"导航项
- [ ] 3.9 在 `App.tsx` 注册 `/cms/adventure` 路由

## 4. 学生端首页入口重构（Change 2）
- [ ] 4.1 重构 `MainMenu.tsx`：双入口设计（主线闯关 + 自由练习）
- [ ] 4.2 主线闯关 → `/client/adventure`，自由练习 → `/client/free`
- [ ] 4.3 创建 `FreePracticeHub.tsx`：四宫格卡片（单音/双音/符号/音型）
- [ ] 4.4 在 `App.tsx` 注册 `/client/adventure`、`/client/adventure/quiz/:stageId`、`/client/free`、`/client/free/:moduleId` 路由
- [ ] 4.5 调整 `StageSelector.tsx` 返回按钮：使用 `navigate(-1)` 动态返回 + `window.history.length > 1` 兜底

## 5. 学生端冒险地图（Change 2）
- [ ] 5.1 创建 `AdventureMap.tsx` 组件
- [ ] 5.2 实现"返回首页"按钮连接
- [ ] 5.3 实现关口进度卡片（进度统计 + 进度条）
- [ ] 5.4 实现 quest board 路线展示（按 levelNum 排序）
- [ ] 5.5 实现三种关卡状态：locked（锁定，不可点击）/ ready（可闯关） / complete（已完成）
- [ ] 5.6 实现加载态：数据加载中显示 spinner
- [ ] 5.7 实现错误态：加载失败时显示错误提示 + 重试按钮
- [ ] 5.8 实现空状态：`adventureStages.length === 0` 时显示"老师还没有配置闯关路线"
- [ ] 5.9 实现关卡点击跳转到 `/client/adventure/quiz/:stageId`
- [ ] 5.10 CSS 样式：quest board 竖线连接、关卡卡片、圆点图标、进度条

## 6. InteractiveQuiz 冒险适配（Change 2）
- [ ] 6.1 在 `InteractiveQuiz.tsx` 中增加冒险 ID 前缀检测：在 `stageId.split('_')` 之前检查 `stageId.startsWith('adventure_route_')`
- [ ] 6.2 冒险解析路径：前缀匹配后调用 `getAdventureStages()` 获取关卡数据
- [ ] 6.3 实现冒险题目数量适配：不足时循环补题（`repeatQuestions` 辅助函数）
- [ ] 6.4 实现空题保护：`stage.slices.length === 0` 时显示提示页
- [ ] 6.5 实现冒险进度推进：答题完成后调用 `completeAdventureStage(stageId)`
- [ ] 6.6 实现完成后的导航：显示"返回冒险地图"按钮，跳转到 `/client/adventure`

## 7. 样式适配
- [ ] 7.1 新增 `index.css` 中 adventure 系列 class
- [ ] 7.2 新增学习首页（`.learning-home`）样式
- [ ] 7.3 新增自由练习（`.free-page`、`.free-grid`）样式
- [ ] 7.4 新增冒险地图（`.adventure-game-page`、`.adventure-quest-board`、`.adventure-quest-card`）样式
- [ ] 7.5 新增 CMS 排关编辑器（`.adventure-cms-page`）样式
- [ ] 7.6 响应式适配（max-width 920px 断点）
