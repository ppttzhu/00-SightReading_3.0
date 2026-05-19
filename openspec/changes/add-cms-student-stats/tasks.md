## 1. Store: Admin Query Actions
- [x] 1.1 Add `fetchAllProfiles()` — 列出全部学生（role = 'student'），利用 admin-read RLS
- [x] 1.2 Add `fetchAllUserTypeStats()` — 拉取全部用户的类型统计（admin-read RLS）
- [x] 1.3 Add `fetchAllStudentProgress()` — 拉取全部学生的模块解锁进度（admin-read RLS）
- [x] 1.4 Add `fetchStudentPracticeRecords(userId, params)` — 拉取指定学生的答题记录，支持 `limit`/`offset` + `isCorrect` 筛选

## 2. Stats Page Component
- [x] 2.1 Create `src/pages/cms/Stats.tsx`
- [x] 2.2 权限检测：挂载时检查 `useAuth().profile.role`，非 admin 显示"仅管理员可查看"
- [x] 2.3 题型概览卡片：4 列 grid，每类型一张卡片（中文标签 + 汇总总数 / 正确率 / 迷你进度条）
- [x] 2.4 学生列表：按总答题数降序、每张卡片显示昵称 / 类型徽章 / 模块解锁进度 / 总答题数 / 最后活跃时间、支持按昵称搜索
- [x] 2.5 手动刷新按钮
- [x] 2.6 学生详情弹窗：首屏 50 条 + "加载更多"、支持"全部 / 仅错题"切换、表格列含日期/类型/题目/对错/用时/分数
- [x] 2.7 加载 / 空态 / 错误状态处理

## 3. Route & Navigation
- [x] 3.1 App.tsx: 添加 `<Route path="stats" element={<Stats />} />`
- [x] 3.2 CMSLayout.tsx: NAV_ITEMS 追加 "学生统计"

## 4. Verification
- [ ] 4.1 `npx tsc -b` 通过
- [ ] 4.2 `npx vitest run` 全部通过
- [ ] 4.3 以 admin 登录 → 左侧"学生统计"可见 → 页面正常加载
- [ ] 4.4 学生端答题后刷新 CMS stats → 数据实时更新
- [ ] 4.5 无学生数据时显示空态提示
- [ ] 4.6 非 admin 角色访问时显示权限提示
- [ ] 4.7 弹窗"加载更多"分页正常工作
- [ ] 4.8 `openspec validate add-cms-student-stats --strict` 通过
