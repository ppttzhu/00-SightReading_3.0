## MODIFIED Requirements

### Requirement: Student List View
教师 SHALL 能在 CMS 中查看所有已注册学生的列表，包含每个学生的练习总量、各模块标签、模块解锁进度和最后活跃时间，按答题总量降序排列。

#### Scenario: 列表加载成功
- **WHEN** 教师（admin）访问 `/cms/stats`
- **THEN** 系统并行从 `profiles`（role = 'student'）、`user_slice_stats`（JOIN `quizzes`）、`student_progress` 三表拉取数据
- **AND** 按总答题数降序显示学生卡片，每张含：昵称、总答题数、各模块标签（中文）、各模块解锁进度、最后练习时间
- **AND** 支持按昵称搜索过滤
- **AND** 提供手动刷新按钮

#### Scenario: 无学生数据
- **WHEN** 没有 role = 'student' 的 profiles 记录
- **THEN** 页面显示"暂无学生练习数据"空态提示

#### Scenario: 学生存在但未练习
- **WHEN** 某学生在 `user_slice_stats` 和 `student_progress` 中均无记录
- **THEN** 该学生卡片仍显示，总答题数为 0，最后活跃显示"未练习"，解锁进度显示默认值

#### Scenario: 权限不足
- **WHEN** 当前登录用户 role 不是 admin
- **THEN** 页面显示"仅管理员可查看"权限提示，不拉取学生数据

### Requirement: Type-Level Aggregate Cards
教师 SHALL 在统计页面顶部看到按模块（notes/symbols/theory/patterns）汇总的全学生练习统计，数据来源为 `user_slice_stats` JOIN `quizzes` 按 module 聚合。

#### Scenario: 各模块统计数据展示
- **WHEN** 统计页面加载成功
- **THEN** 顶部展示 4 张模块卡片，每张显示该模块的全学生总答题数和正确率
- **AND** 正确率以百分比数字和迷你进度条形式呈现

#### Scenario: 某模块无数据
- **WHEN** 某模块在 `user_slice_stats` 中没有任何记录
- **THEN** 对应卡片显示总数为 0，正确率为 0%

### Requirement: Student Detail Modal
教师 SHALL 能点击学生卡片查看该学生的详细答题记录，支持按"全部 / 仅错题"筛选，支持分页加载。

#### Scenario: 查看学生答题记录（首屏 50 条）
- **WHEN** 教师点击某学生卡片
- **THEN** 弹出一个模态框，加载并展示该学生最近 50 条 `practice_records`（按时间倒序）
- **AND** 表格显示：答题日期、模块、题目 ID、对错、作答用时
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

## ADDED Requirements

### Requirement: Per-Quiz Stats Table
系统 SHALL 使用 `user_slice_stats` 表（替代 `user_type_stats`）按 `(user_id, quiz_id)` 粒度永久记录每道题的答题统计，包含 `total_count`、`correct_count`、`wrong_count`、`last_practiced_at`。

#### Scenario: 答题后统计更新
- **WHEN** `practice_records` 插入一条新记录
- **THEN** 触发器 UPSERT `user_slice_stats` 中对应 `(user_id, quiz_id)` 行的计数

#### Scenario: 查询学生错题最多的题目
- **WHEN** admin 查询某学生的薄弱题目
- **THEN** 可通过 `SELECT quiz_id, wrong_count FROM user_slice_stats WHERE user_id = ? ORDER BY wrong_count DESC` 获取

### Requirement: Challenge Success Records
系统 SHALL 使用 `test_success_records` 表记录闯关成功事件，每个学生每个关卡保留最新一次成功记录，用于排行榜展示。表包含 `user_id`、`stage_id`、`correct_count`、`wrong_count`、`time_spent_sec`、`score`、`created_at`，PK 为 `(user_id, stage_id)`。

#### Scenario: 闯关成功写入排行榜
- **WHEN** 学生完成一个关卡且通过
- **THEN** 前端 UPSERT `test_success_records`，`score` 由前端计算后传入

#### Scenario: 重玩关卡覆盖记录
- **WHEN** 学生再次通过同一关卡
- **THEN** `test_success_records` 中该 `(user_id, stage_id)` 行被覆盖为最新成绩

### Requirement: Lean Practice Records
`practice_records` 表 SHALL 仅包含 `id`、`user_id`、`stage_id`（NULL=练习模式，NOT NULL=闯关模式）、`quiz_id`（原 `slice_id`）、`module`、`is_correct`、`answered_wrong`、`time_spent_ms`、`created_at`，不含 `slice_type`、`score`、`del_status`。

#### Scenario: 练习模式记录
- **WHEN** 学生在练习模式答题
- **THEN** `practice_records` 插入一行，`stage_id = NULL`

#### Scenario: 闯关模式记录
- **WHEN** 学生在闯关模式答题
- **THEN** `practice_records` 插入一行，`stage_id = <关卡ID>`

### Requirement: Student Progress Natural PK
`student_progress` 表 SHALL 使用 `(user_id, module)` 作为复合主键，不含 `id BIGSERIAL` 和 `del_status` 列。

#### Scenario: 进度 UPSERT
- **WHEN** 学生解锁新关卡
- **THEN** `student_progress` UPSERT 以 `(user_id, module)` 为冲突键，更新 `unlocked`
