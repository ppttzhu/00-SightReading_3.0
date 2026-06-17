## ADDED Requirements

### Requirement: 数据库 —— stage_comment 表
系统 SHALL 使用 `stage_comment` 表存储所有对关卡的评论及回复，采用自引用 `parent_id` 表达树形结构。

#### Scenario: 主评论插入
- **WHEN** 学生完成关卡后提交一条对关卡的评论
- **THEN** 写入 `stage_comment` 表，`parent_id` 为 NULL，`stage_id` 为该关卡 ID

#### Scenario: 回复插入
- **WHEN** 学生对一条已有评论进行回复
- **THEN** 写入 `stage_comment` 表，`parent_id` 为被回复的评论的 ID，`stage_id` 继承自目标评论

#### Scenario: 级联删除
- **WHEN** 一条主评论被删除
- **THEN** 其所有回复（`parent_id` 指向该评论的行）MUST 被级联删除（`ON DELETE CASCADE`）。删除 parent 连带删除 children，不做软删除

### Requirement: 数据库 —— RLS 权限策略
系统 SHALL 通过 Supabase Row-Level Security 控制评论和点赞的访问权限，**仅评论作者可删除自己的评论**。

#### Scenario: 评论 SELECT
- **WHEN** 任何已登录用户查询 `stage_comment` 表
- **THEN** 返回所有行（`FOR SELECT TO authenticated USING (true)`），评论是公开的

#### Scenario: 评论 INSERT
- **WHEN** 用户提交新评论
- **THEN** 仅当 `user_id = auth.uid()` 时才允许插入（`FOR INSERT WITH CHECK (auth.uid() = user_id)`）

#### Scenario: 评论 DELETE
- **WHEN** 用户尝试删除一条评论
- **THEN** 仅当 `auth.uid() = user_id` 时才允许删除（`FOR DELETE USING (auth.uid() = user_id)`）。不留管理员删除通道，不走软删除

#### Scenario: 点赞 INSERT
- **WHEN** 用户点赞一条评论
- **THEN** 仅当 `user_id = auth.uid()` 时才允许插入，联合主键 `(comment_id, user_id)` 防止重复点赞

#### Scenario: 点赞 DELETE
- **WHEN** 用户取消点赞
- **THEN** 仅当 `auth.uid() = user_id` 时才允许删除

### Requirement: 数据库 —— comment_like 表
系统 SHALL 使用 `comment_like` 表存储用户对评论的点赞关系，以 `(comment_id, user_id)` 为联合主键。

#### Scenario: 添加点赞
- **WHEN** 用户对某条评论点击点赞
- **THEN** 写入 `comment_like` 表，同时 `stage_comment.like_count` 自增 1

#### Scenario: 取消点赞
- **WHEN** 用户对已点赞的评论再次点击点赞
- **THEN** 从 `comment_like` 表删除该行，同时 `stage_comment.like_count` 自减 1

### Requirement: 回顾页底部写评论
系统 SHALL 在 `InteractiveQuiz` 回顾页的答题列表之后、底部固定栏之前，放置一个紧凑的评论输入区。

#### Scenario: 输入区展示
- **WHEN** 用户滚动回顾页到答题列表底部
- **THEN** 展示一行轻量输入区，包含文本输入框和提交按钮，不占初始视口

#### Scenario: 提交评论
- **WHEN** 用户在输入区内填写内容后点击提交
- **THEN** 调用 API 写入 `stage_comment`，成功后显示简短成功提示，输入区清空

#### Scenario: 专注冒险模式
- **WHEN** 学生使用 `PracticeQuiz`（自由练习模式）完成答题
- **THEN** 回顾页不展示评论输入区，评论功能仅在冒险模式（`InteractiveQuiz`）中提供

#### Scenario: 组件提取
- **WHEN** `InteractiveQuiz` 渲染回顾页
- **THEN** 回顾面板 MUST 为独立组件 `ReviewPanel.tsx`，而非内联在 `InteractiveQuiz.tsx` 中

### Requirement: 关卡详情页浏览评价
系统 SHALL 提供 `/client/adventure/stage/:stageId` 页面，展示关卡信息、个人历史成绩、所有评论及互动功能。

#### Scenario: 评价列表
- **WHEN** 学生进入关卡详情页
- **THEN** 展示该关卡的所有主评论，按点赞数降序排列，每条展示内容、作者（匿名）、时间、点赞按钮、评论数和回复列表

#### Scenario: 树形回复
- **WHEN** 学生展开某条评论的回复
- **THEN** 展示该评论下的所有回复，按时间正序排列，每条回复展示内容、作者、时间。支持多层嵌套，`parent_id` 指向直接上级

#### Scenario: 写评论入口
- **WHEN** 学生已完成该关卡
- **THEN** 详情页顶部展示写评论输入框；未完成关卡的学生只能浏览不能写

### Requirement: 冒险地图卡片评价入口
系统 SHALL 在冒险地图上已完成的关卡卡片中，显示评论数并可通过点击进入关卡详情页。

#### Scenario: 评论数展示
- **WHEN** 冒险地图渲染已完成关卡卡片
- **THEN** 卡片右下角或合适位置显示 `💬 N` 的评论总数（包含回复）

#### Scenario: 点击进入详情
- **WHEN** 学生点击评论数区域
- **THEN** 导航到 `/client/adventure/stage/:stageId`

### Requirement: 点赞互动
系统 SHALL 允许已登录用户对评论进行点赞和取消点赞。

#### Scenario: 点赞状态切换
- **WHEN** 用户点击未点赞的评论的点赞按钮
- **THEN** 点赞计数 +1，按钮变为已点赞状态
- **WHEN** 用户再次点击已点赞的评论的点赞按钮
- **THEN** 点赞计数 -1，按钮恢复为未点赞状态

### Requirement: 点赞计数原子性
系统 SHALL 保证 `like_count` 与 `comment_like` 表的数据一致性，不得在应用层分别执行 INSERT/UPDATE。

#### Scenario: 使用触发器或 RPC
- **WHEN** 用户对评论执行点赞（INSERT `comment_like`）
- **THEN** `stage_comment.like_count` MUST 通过 PostgreSQL 触发器或 Supabase RPC 原子性自增，无需应用层手写 UPDATE
- **WHEN** 用户取消点赞（DELETE FROM `comment_like`）
- **THEN** `stage_comment.like_count` MUST 通过同等方式原子性自减

### Requirement: 回复互动
系统 SHALL 允许已登录用户对评论进行回复，使用 `parent_id` 自引用组织为树形结构。

#### Scenario: 回复评论
- **WHEN** 用户点击某条评论的"回复"按钮
- **THEN** 在该评论下方展开一个内联输入框，用户输入内容后提交

#### Scenario: 回复深度
- **WHEN** 用户回复一条已属于某线程的回复
- **THEN** 新回复的 `parent_id` 指向被回复的那条具体评论（支持多层嵌套）

### Requirement: 空状态
系统 SHALL 在对应 UI 区域展示合适的空状态提示。

#### Scenario: 暂无评论
- **WHEN** 关卡详情页或冒险地图上该关卡尚无任何评论
- **THEN** 展示"暂无评论，来写第一条吧"的友好提示

#### Scenario: 数据加载中
- **WHEN** 关卡详情页正在加载评论数据
- **THEN** 展示 spinner 或骨架屏

#### Scenario: 加载失败
- **WHEN** 评论数据因网络或服务器错误无法加载
- **THEN** 展示"加载失败，请重试"提示和重试按钮
