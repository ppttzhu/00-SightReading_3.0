## ADDED Requirements

### Requirement: Student List View
教师 SHALL 能在 CMS 中查看所有已注册学生的列表，包含每个学生的练习总量、各题型标签、模块解锁进度和最后活跃时间，按答题总量降序排列。

#### Scenario: 列表加载成功
- **WHEN** 教师（admin）访问 `/cms/stats`
- **THEN** 系统并行从 `profiles`（role = 'student'）、`user_type_stats`、`student_progress` 三表拉取数据
- **AND** 按总答题数降序显示学生卡片，每张含：昵称、总答题数、各题型标签（中文 + A/B/C/D）、各模块解锁进度、最后练习时间
- **AND** 支持按昵称搜索过滤
- **AND** 提供手动刷新按钮

#### Scenario: 无学生数据
- **WHEN** 没有 role = 'student' 的 profiles 记录
- **THEN** 页面显示"暂无学生练习数据"空态提示

#### Scenario: 学生存在但未练习
- **WHEN** 某学生在 `user_type_stats` 和 `student_progress` 中均无记录
- **THEN** 该学生卡片仍显示，总答题数为 0，最后活跃显示"未练习"，解锁进度显示默认值

#### Scenario: 权限不足
- **WHEN** 当前登录用户 role 不是 admin
- **THEN** 页面显示"仅管理员可查看"权限提示，不拉取学生数据

### Requirement: Type-Level Aggregate Cards
教师 SHALL 在统计页面顶部看到按题目类型（A=单音 / B=符号 / C=乐理 / D=音型）汇总的全学生练习统计。

#### Scenario: 各类型统计数据展示
- **WHEN** 统计页面加载成功
- **THEN** 顶部展示 4 张类型卡片，每张显示该类型的全学生总答题数和正确率
- **AND** 正确率以百分比数字和迷你进度条形式呈现

#### Scenario: 某类型无数据
- **WHEN** 某题型（如 D 类）在 `user_type_stats` 中没有任何记录
- **THEN** 对应卡片显示总数为 0，正确率为 0%

### Requirement: Student Detail Modal
教师 SHALL 能点击学生卡片查看该学生的详细答题记录，支持按"全部 / 仅错题"筛选，支持分页加载。

#### Scenario: 查看学生答题记录（首屏 50 条）
- **WHEN** 教师点击某学生卡片
- **THEN** 弹出一个模态框，加载并展示该学生最近 50 条 `practice_records`（按时间倒序）
- **AND** 表格显示：答题日期、类型、题目 ID、对错、作答用时、分数
- **AND** 底部有"加载更多"按钮，每次追加 50 条

#### Scenario: 筛选错题
- **WHEN** 教师在详情弹窗内切换到"仅错题"
- **THEN** 重新查询并展示该学生 `is_correct = false` 的记录（首屏 50 条，支持加载更多）

#### Scenario: 学生无答题记录
- **WHEN** 教师点击一个从未答题的学生
- **THEN** 弹窗显示"该学生暂无练习记录"

### Requirement: Admin-Only Access
`/cms/stats` 路由 SHALL 仅允许 `profiles.role = 'admin'` 的用户访问。

#### Scenario: Admin 访问通过
- **WHEN** 角色为 admin 的用户访问 `/cms/stats`
- **THEN** 页面正常渲染

#### Scenario: 非 admin 被拦截
- **WHEN** 角色为 student 的用户或无认证用户访问 `/cms/stats`
- **THEN** 被 `CMSAuthGate` 拦截，重定向到登录页或返回无权限提示
