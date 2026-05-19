## Context

CMS 目前只有题库管理能力（录题/关卡编排/反馈），没有学生数据查看入口。Supabase 已有完整的 RLS 授权链路：
- `practice_records`、`user_type_stats`、`student_progress`、`profiles` 四张表均配了 `_admin_read` 策略
- `current_user_role()` 函数已可用

## Goals / Non-Goals

- Goals: 教师能查看全部学生的练习活动、各题型正确率、单学生的答题明细
- Non-Goals: 不引入图表库（recharts/echarts 等）；不做实时推送（刷新才更新）；不导出报表

## Decisions

### Decision: 新增 3 个 store action，而非绕过 store 直接调 supabase
- **Rationale**: 统一数据访入口；未来如需缓存/错误处理优化只需改 store；所有 Supabase 引用集中在 store
- **Alternatives considered**: 直接在 Stats 组件里 `supabase.from(...)` —— 更快但打破现有分层约定

### Decision: 前端 Join 而非后端视图
- **Rationale**: 数据量级小（几十个学生），`Promise.all([profiles, userTypeStats, studentProgress])` 三表一次拉完，前端 `Map<userId, ...>` 聚合。建 DB 视图需迁移 + 维护成本
- **Trade-off**: 学生数 > 500 时需加 pagination

### Decision: 学生列表按答题总量降序
- **Rationale**: 教师的核心问题是"谁在练？谁练得多？"——最活跃的学生应该排最上面

### Decision: 详情弹窗分页（首屏 50 条 + 加载更多）
- **Rationale**: 活跃学生可能累积 300+ 条记录，一次全拉体验差。50 条一页既覆盖近期浏览也保持加载速度
- **Implementation**: store action 接受 `limit` + `offset` 参数

### Decision: 纯 CSS stat cards，不引入图表库
- **Rationale**: 项目无 recharts/echarts 依赖；现有 StageBuilder / FeedbackManager 已有内联样式 stat card 模式；数字 + 色条已足够传达准确率信息

### Decision: 学生详情用 fixed overlay modal，不做路由跳转
- **Rationale**: 遵循 StageBuilder 中 ClearConfirmModal 的模式；避免状态在路由间传递

## Risks / Trade-offs

- Admin RLS 已配置但尚未端对端验证 → 页面挂载时检测 `current_user` 的 role，非 admin 时显示"权限不足"而非空态，防止 RLS 失效被误判为无数据
- `profiles` 表若无学生数据，页面为空 → 设计空态提示 + 刷新按钮

## Data Flow

```
Stats.tsx useEffect
  → store.fetchAllProfiles()          → supabase.from('profiles').select('id,nickname,role').eq('role','student')
  → store.fetchAllUserTypeStats()     → supabase.from('user_type_stats').select('*')
  → store.fetchAllStudentProgress()   → supabase.from('student_progress').select('user_id,module,unlocked')
  → 前端 join: Map<userId, { stats, progress }>
  → 排序: 按 totalPracticed 降序
  → setState(students)

学生卡片点击
  → store.fetchStudentPracticeRecords(userId, { isCorrect, limit: 50, offset: 0 })
  → supabase.from('practice_records').select('*').eq('user_id', userId).limit(50)
  → setState(studentRecords)
  → Modal 展示

"加载更多"
  → store.fetchStudentPracticeRecords(userId, { isCorrect, limit: 50, offset: 50 })
  → 追加到 studentRecords
```
