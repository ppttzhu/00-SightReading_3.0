# Change: CMS 学生统计看板

## Why

`practice_records` 和 `user_type_stats` 已完整记录学生答题数据，但 CMS 端缺乏任何可视化入口。教师需要看到"哪些学生在练习、各题型的正确率如何"，才能针对性调整题库和教学。

## What Changes

- **Store**: 新增 3 个 admin 查询 action，利用已有 admin-read RLS 查询全量学生数据
- **新页面**: `/cms/stats` — 学生统计看板（题型概览卡片 + 学生列表 + 学生详情弹窗）
- **路由 + 导航**: 在 App.tsx 注册路由，在 CMSLayout 侧边栏增加入口
- **无新依赖**: 纯 CSS stat cards，沿用 StageBuilder/FeedbackManager 内联样式模式

## Impact

- Affected specs: 新 `student-stats`
- Affected code: `useAppStore.ts`（+3 action）、`Stats.tsx`（新）、`App.tsx`（+1 route）、`CMSLayout.tsx`（+1 nav item）
- 零破坏: 不修改任何现有组件或数据库 schema
