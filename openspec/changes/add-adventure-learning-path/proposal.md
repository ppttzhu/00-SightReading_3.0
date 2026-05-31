# Change: Add Adventure Learning Path

## Why
当前学生端首页是四个知识点模块平铺（Notes/Symbols/Interval/Patterns），学生需要自己判断"今天该练什么"，缺少一条由教师编排的、题型混合的线性学习路线。这导致：初学者不知道练习顺序、自由练习和闯关模式边界模糊、教师无法通过路线编排引导学生逐步进阶。

## What Changes
- **首页入口重构**：从四宫格改为双入口（主线闯关 + 自由练习），自由练习点进去仍是四宫格
- **新增冒险关卡数据模型**：`AdventureStage` 独立数组，通过 `sourceStageId` 引用 `customStages`
- **数据库持久化**：新增 `adventure_paths` 表存储冒险关卡数据
- **教师端排关工具**：`AdventureEditor` 手动排关（从现有关卡库挑选排序）+ AI 自动草稿
- **学生端冒险地图**：`AdventureMap` 线性路线图 + 独立进度解锁
- **InteractiveQuiz 适配**：支持解析冒险关卡 ID，答题完成后推进冒险进度
- **空状态处理**：教师未排关时，冒险地图显示空状态提示，不展示预设骨架

## Impact
- **新数据模型**：`AdventureStage` 类型、`adventure_paths` 数据库表
- **受影响前端组件**：`App.tsx`（路由）、`MainMenu`（入口重构）、`InteractiveQuiz`（冒险适配）、`StageSelector`（返回路径调整）
- **新增前端组件**：`AdventureMap`、`FreePracticeHub`、`AdventureEditor`
- **受影响存储层**：`StageData` 接口、`useRemoteSync`、`SupabaseStorageProvider`
- **新增依赖**：推荐 `@dnd-kit/core`（拖拽排序，可选）
- **受影响 spec**：`adventure-path`（新增能力）
