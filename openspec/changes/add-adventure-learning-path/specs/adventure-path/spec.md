## ADDED Requirements

### Requirement: Adventure Stage Data Model
系统 SHALL 定义 `AdventureStage` 数据模型，独立于 `CustomStage`，通过 `sourceStageId` 软引用现有关卡。该类型 SHALL 包含 `id`、`title`、`levelNum`、`sourceStageId`、`sliceIds`、`questionCount`、`unlockRule`、`source` 字段。

#### Scenario: AdventureStage 类型定义
- **WHEN** 在 `useAppStore.ts` 中定义类型
- **THEN** `AdventureStage` MUST 包含以下字段：
  - `id: string` — 唯一标识，格式 `adventure_route_${timestamp}_${sourceStageId}`
  - `title: string` — 关卡标题
  - `description?: string` — 可选描述
  - `levelNum: number` — 排序序号，自动维护
  - `sourceStageId?: string` — 引用 `customStages` 中的关卡 ID
  - `sourceModule?: QuizModuleId` — 来源模块
  - `sliceIds: string[]` — 直接引用 slicesPool 的 ID（无 sourceStage 时兜底）
  - `questionCount: number` — 题目数量
  - `unlockRule: 'previous_clear'` — 统一解锁规则
  - `source: 'manual' | 'assistant'` — 来源标记
  - `createdAt?: number` — 创建时间戳
  - `updatedAt?: number` — 更新时间戳

#### Scenario: AdventureStage 引用解析
- **WHEN** `getAdventureStages()` 调用，某 `AdventureStage` 的 `sourceStageId` 指向一个存在的 `CustomStage`
- **THEN** 返回的 `AutoStage` 使用该 `CustomStage` 的 `title`、`sliceIds`、`questionCount`

#### Scenario: AdventureStage 引用失效
- **WHEN** `getAdventureStages()` 调用，某 `AdventureStage` 的 `sourceStageId` 在 `customStages` 中不存在
- **THEN** 返回的 `AutoStage` 使用 `AdventureStage` 自身携带的 `sliceIds` 作为兜底，标题保持不变

### Requirement: Adventure Store State
系统 SHALL 在 `useAppStore` 中新增 `adventureStages: AdventureStage[]` 路线状态和 `adventureCompletedStageIds: string[]` 进度记录，以及对应的 CRUD 操作。进度追踪使用 stageId 集合而非数字序号，以避免教师重排关卡后进度错位。

#### Scenario: 初始状态
- **WHEN** 应用首次加载，`useAppStore` 初始化
- **THEN** `adventureStages` MUST 初始化为 `[]`，`adventureCompletedStageIds` MUST 初始化为 `[]`

#### Scenario: 设置冒险关卡
- **WHEN** `setAdventureStages(stages)` 被调用
- **THEN** store 中的 `adventureStages` MUST 替换为新数组，并按 `levelNum` + `createdAt` 排序后重新编码序号

#### Scenario: 添加冒险关卡
- **WHEN** `addAdventureStage(stage)` 被调用，`stage` 不含 `levelNum`
- **THEN** 新关卡 MUST 添加到末尾，`levelNum` 自动设为当前长度 + 1，`unlockRule` 默认为 `'previous_clear'`，`source` 默认为 `'manual'`，`createdAt` 和 `updatedAt` 设为当前时间戳

#### Scenario: 移除冒险关卡
- **WHEN** `removeAdventureStage(id)` 被调用
- **THEN** 对应 `id` 的关卡 MUST 从 `adventureStages` 中移除，剩余关卡 MUST 重新编码 `levelNum`

#### Scenario: 移动冒险关卡
- **WHEN** `moveAdventureStage(id, 'up')` 被调用，且该关卡不是第一关
- **THEN** 该关卡与上一关的位置互换，所有关卡 `levelNum` 重新编码

#### Scenario: 移动最后一关
- **WHEN** `moveAdventureStage(id, 'down')` 被调用，且该关卡是最后一关
- **THEN** state MUST NOT 发生变化

### Requirement: Complete Adventure Stage
系统 SHALL 提供 `completeAdventureStage(stageId)` action，将指定关卡 ID 加入 `adventureCompletedStageIds` 数组（不去重），并自动推进解锁状态。

#### Scenario: 记录完成
- **WHEN** `completeAdventureStage('adventure_route_123_abc')` 被调用
- **THEN** `adventureCompletedStageIds` MUST 包含 `'adventure_route_123_abc'`

#### Scenario: 重复完成幂等
- **WHEN** 同一 stageId 被重复调用
- **THEN** `adventureCompletedStageIds` 中 MUST NOT 出现重复条目

#### Scenario: 完成后的解锁状态
- **WHEN** `adventureCompletedStageIds` 包含第 N 关的 stageId
- **THEN** 第 N+1 关 MUST 为可闯关状态（前提是该关卡存在且有关联 slice）
- **WHEN** `adventureCompletedStageIds` 不包含第 N-1 关的 stageId
- **THEN** 第 N 关 MUST 为锁定状态

### Requirement: Adventure Stage CRUD in Store
系统 SHALL 在 `useAppStore` 中提供 `setAdventureStages`、`addAdventureStage`、`removeAdventureStage`、`moveAdventureStage`、`getAdventureStages` 共 5 个操作方法。

#### Scenario: getAdventureStages 返回解析后的关卡
- **WHEN** `getAdventureStages()` 在 store 外部被调用
- **THEN** 返回 `AutoStage[]`，其中每个 element 的 `module` 为 `'adventure'`，`stageNum` 为序号，`slices` 从 `sliceIds` 映射到 `slicesPool`

#### Scenario: getAdventureStages 无数据时返回空数组
- **WHEN** `adventureStages.length === 0`
- **THEN** `getAdventureStages()` MUST 返回 `[]`（不生成 fallback 数据）

### Requirement: Adventure Progress Independent from Module Progress
系统 SHALL 使用 `adventureCompletedStageIds: string[]` 存储冒险进度，独立于四模块的 `studentProgress`。该数据仅存在本地 store（zustand persist），MUST NOT 同步到 Supabase `student_progress` 表。

#### Scenario: 进度存储在本地
- **WHEN** 学生完成冒险关卡，`completeAdventureStage` 被调用
- **THEN** `adventureCompletedStageIds` MUST 更新，且系统 MUST NOT 调用 `syncUpsertStudentProgress`

#### Scenario: 进度不受重排影响
- **WHEN** 教师重排冒险路线（移动/增删关卡）
- **THEN** `adventureCompletedStageIds` 中的 stageId 记录 MUST 不变，学生的已完成关卡标记不受影响

### Requirement: Database Persistence
系统 SHALL 通过独立数据库表 `adventure_paths` 持久化冒险路线数据。该表 SHALL 包含 UUID 主键、JSONB 存储的 stages 数组、创建时间戳和更新时间戳。

#### Scenario: 创建 adventure_paths 表
- **WHEN** 执行数据库迁移 SQL
- **THEN** `adventure_paths` 表 MUST 存在，包含列 `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`、`stages JSONB NOT NULL DEFAULT '[]'`、`created_at TIMESTAMPTZ`、`updated_at TIMESTAMPTZ`

#### Scenario: 保存冒险路线 — Publish 统一入口
- **WHEN** 教师在 AdventureEditor 编辑完成后点击 CMS Publish 按钮
- **THEN** 系统 MUST 将当前 store 中的 `adventureStages` 和其他数据一起发布
- **AND** Cloudflare 后端：`adventureStages` 作为 `StageData` 的一部分写入 KV
- **AND** Supabase 后端：`adventureStages` 写入 `adventure_paths` 表

#### Scenario: AdventureEditor 不单独写数据库
- **WHEN** 教师在 AdventureEditor 中调整关卡顺序
- **THEN** 仅更新 store 中的 `adventureStages`，不触发数据库写入
- **AND** 依赖 CMS Publish 按钮将变更持久化

#### Scenario: 从数据库加载冒险路线
- **WHEN** 应用加载时，`adventure_paths` 表中有数据
- **THEN** 系统 MUST 将其 `stages` 列的内容加载到 `useAppStore.adventureStages`

#### Scenario: 无数据时保持空状态
- **WHEN** `adventure_paths` 表为空或不存在
- **THEN** `adventureStages` MUST 保持 `[]`，不生成预设数据

### Requirement: StageData Serialization
系统 SHALL 在 `StageData` 接口中新增可选字段 `adventureStages?: AdventureStage[]`，确保与现有数据格式向后兼容。

#### Scenario: 同步携带冒险数据
- **WHEN** 调用 `usePublish()` 发布数据
- **THEN** publish 的 `StageData` 对象 MUST 包含 `adventureStages: state.adventureStages`

#### Scenario: 加载兼容无冒险数据的老数据
- **WHEN** 加载不含 `adventureStages` 字段的旧 `StageData`
- **THEN** 系统 MUST 视作 `adventureStages = []`，不报错

### Requirement: CustomStage Deletion Reference Check
系统 SHALL 在删除 `CustomStage` 时检查是否有 `AdventureStage.sourceStageId` 指向它。如有引用，SHALL 阻止删除并提示教师被哪些冒险关卡引用。

#### Scenario: 删除被引用的 CustomStage
- **WHEN** 教师尝试删除一个被至少一个 `AdventureStage.sourceStageId` 指向的 `CustomStage`
- **THEN** 系统 MUST 阻止删除，并显示提示信息列出引用该关卡的冒险关卡标题

#### Scenario: 删除无引用的 CustomStage
- **WHEN** 教师尝试删除一个未被任何 `AdventureStage` 引用的 `CustomStage`
- **THEN** 系统 MUST 正常执行删除

### Requirement: Adventure Editor — Manual Mode
教师 SHALL 可以通过 CMS 页面（`/cms/adventure`）的手动模式，从现有关卡库中挑选关卡并排序，形成正式冒险路线。

#### Scenario: 显示现有关卡库
- **WHEN** 教师进入手动排关模式
- **THEN** 左侧面板展示从 `customStages` 中筛选出的关卡列表，每个关卡显示标题、模块标签、题目数、平均难度

#### Scenario: 模块筛选
- **WHEN** 教师在左侧面板选择模块筛选条件（例：仅显示 'theory'）
- **THEN** 关卡列表 MUST 仅显示该模块的关卡

#### Scenario: 搜索关卡
- **WHEN** 教师在搜索框输入标题关键词
- **THEN** 关卡列表 MUST 仅显示标题包含该关键词的关卡

#### Scenario: 加入主线
- **WHEN** 教师点击某个关卡旁的"加入主线"按钮
- **THEN** 该关卡 MUST 出现在右侧正式路线列表中，按钮变为"已在主线"（disabled）

#### Scenario: 重复加入提示
- **WHEN** 教师点击一个已在主线中的关卡的"加入主线"按钮
- **THEN** 系统 MUST 提示"这关已经在主线里了"，不产生重复条目

#### Scenario: 关卡状态显示
- **WHEN** 教师在右侧正式路线列表中查看关卡
- **THEN** 每关显示序号（Lv.N）、标题、健康状态（ok/warn/bad）、模块标签、平均难度

#### Scenario: 关卡健康状态
- **WHEN** 冒险关卡引用的 sourceStage 已不复存在
- **THEN** 该关卡健康状态标记为 bad，文案显示"原关卡已失效"

#### Scenario: 空关卡状态
- **WHEN** 冒险关卡引用的 sourceStage 存在但无 slice
- **THEN** 该关卡健康状态标记为 bad，文案显示"空关卡"

#### Scenario: 上移/下移关卡
- **WHEN** 教师在右侧路线列表中点击某个关卡的"上移"按钮
- **THEN** 该关卡与上一关位置互换，所有关卡重新编码 levelNum
- **WHEN** 教师点击"下移"按钮
- **THEN** 该关卡与下一关位置互换，所有关卡重新编码 levelNum

#### Scenario: 移出路线
- **WHEN** 教师点击某个关卡的"移出路线"按钮
- **THEN** 该关卡从右侧路线列表中移除，左侧对应关卡的按钮恢复为"加入主线"
- **WHEN** 教师点击第一关的"上移"按钮或最后一关的"下移"按钮
- **THEN** 操作无效果，按钮为 disabled 状态

#### Scenario: 空状态文案
- **WHEN** 左侧现有关卡库为空（`customStages.length === 0`）
- **THEN** 显示提示"还没有可排序的现有关卡。请先去'关卡编排'创建普通关卡。"
- **WHEN** 右侧正式路线为空
- **THEN** 显示提示"还没有正式主线。点击左侧关卡的'加入主线'，它会出现在这里；学生端会按这里的顺序闯关。"

### Requirement: Student Adventure Map
学生 SHALL 可以通过 `/client/adventure` 访问冒险路线地图，以线性路线图形式展示所有关卡，支持锁定/可闯关/已完成三种状态。

#### Scenario: 返回首页
- **WHEN** 学生点击冒险地图页面的"返回首页"按钮
- **THEN** 导航到 `/client`

#### Scenario: 进度展示
- **WHEN** 冒险地图加载完成且有关卡数据
- **THEN** 页面顶部展示已完成/总关卡数（根据 `adventureCompletedStageIds` 计算）及进度条

#### Scenario: 关卡地图展示
- **WHEN** `adventureStages.length > 0`
- **THEN** 页面以 quest board 形式展示所有关卡，按 levelNum 顺序排列，每关显示关卡标题（从引用的 customStage 获取）、题目数

#### Scenario: 未解锁关卡
- **WHEN** 前一关的 stageId 不在 `adventureCompletedStageIds` 中（第一关无前置条件）
- **THEN** 该关卡显示为锁定状态（锁图标），不可点击

#### Scenario: 可闯关关卡
- **WHEN** 前一关的 stageId 在 `adventureCompletedStageIds` 中（或该关卡为第一关），且该关卡本身未完成
- **THEN** 该关卡显示为"当前可闯关"状态（播放图标），点击导航到 `/client/adventure/quiz/:stageId`

#### Scenario: 已完成关卡
- **WHEN** 该关卡的 stageId 在 `adventureCompletedStageIds` 中
- **THEN** 该关卡显示为"已完成"状态（勾选图标），颜色标记为绿色

#### Scenario: 空状态
- **WHEN** `adventureStages.length === 0`
- **THEN** 页面显示空状态提示"还没有可用主线"，不展示 quest board

#### Scenario: 加载态
- **WHEN** 冒险路线数据正在从后端加载
- **THEN** 页面 SHALL 显示 spinner 或骨架屏加载指示器

#### Scenario: 错误态
- **WHEN** 冒险路线数据加载失败（网络错误 / 数据库查询失败）
- **THEN** 页面 SHALL 显示错误提示信息并提供"重试"按钮

### Requirement: InteractiveQuiz Adventure Stage Resolution
系统 SHALL 在 `InteractiveQuiz` 中识别并解析冒险关卡 ID（`/client/adventure/quiz/:stageId` 路由）。冒险 ID 以 `adventure_route_` 为前缀，与现有 custom/auto 关卡的 `stageId.split('_')` 解析逻辑互斥。检测分支 MUST 放在 split 逻辑之前。

#### Scenario: 冒险 ID 前缀检测
- **WHEN** `stageId` 以 `adventure_route_` 开头
- **THEN** 系统 MUST 跳过 `stageId.split('_')` 解析路径，直接调用 `getAdventureStages()` 匹配 `stageId`
- **AND** 系统 MUST 使用匹配结果作为答题关卡数据

#### Scenario: 非冒险 ID 不受影响
- **WHEN** `stageId` 不以 `adventure_route_` 开头（如 `custom_xxx` 或 `auto_notes_1`）
- **THEN** 系统 MUST 走原有的 `stageId.split('_')` 解析逻辑，行为不变

#### Scenario: 显示冒险关卡题目
- **WHEN** 学生通过 `/client/adventure/quiz/:stageId` 进入答题，且匹配成功
- **THEN** 系统使用匹配到的 `AutoStage` 展示题目

#### Scenario: 冒险关卡题目数量不足
- **WHEN** 冒险关卡的 `questionCount > slices.length`
- **THEN** 系统 MUST 循环打乱 slices 直到凑足 `questionCount` 题

#### Scenario: 冒险关卡空题保护
- **WHEN** 冒险关卡的 `slices.length === 0`
- **THEN** 显示提示页"这关还没有可用题目"和返回按钮

#### Scenario: 完成冒险关卡记录进度
- **WHEN** 学生完成一个冒险关卡的所有题目
- **THEN** 系统 MUST 调用 `completeAdventureStage(stageId)`，将当前关卡 ID 加入 `adventureCompletedStageIds`

#### Scenario: 冒险完成后的导航
- **WHEN** 学生完成一个冒险关卡的所有题目
- **THEN** 完成页面 SHALL 显示"返回冒险地图"按钮，点击后导航到 `/client/adventure`

### Requirement: Main Menu Double Entry
学生端首页 SHALL 展示两个主要入口卡片："主线闯关"和"自由练习"。自由练习点入后展示四模块入口。

#### Scenario: 双入口展示
- **WHEN** 学生访问 `/client`
- **THEN** 页面展示两张入口卡片，左侧为主"主线闯关"（带 Route 图标），右侧为"自由练习"（带 Dumbbell 图标）

#### Scenario: 点击主线闯关
- **WHEN** 学生点击"主线闯关"卡片
- **THEN** 导航到 `/client/adventure`

#### Scenario: 点击自由练习
- **WHEN** 学生点击"自由练习"卡片
- **THEN** 导航到 `/client/free`

#### Scenario: 自由练习四宫格
- **WHEN** 学生访问 `/client/free`
- **THEN** 页面显示四个模块入口卡片：单音自由练习、双音/音程自由练习、符号题库、音型题库

#### Scenario: 自由练习跳转
- **WHEN** 学生点击"单音自由练习"卡片
- **THEN** 导航到 `/client/practice/notes?low=C2&high=C6`
- **WHEN** 学生点击"双音/音程自由练习"卡片
- **THEN** 导航到 `/client/practice/intervals`
- **WHEN** 学生点击"符号题库"卡片
- **THEN** 导航到 `/client/free/symbols`
- **WHEN** 学生点击"音型题库"卡片
- **THEN** 导航到 `/client/free/patterns`

### Requirement: StageSelector Back Navigation
StageSelector 的返回按钮 SHALL 使用 `navigate(-1)` 动态返回，并带兜底逻辑：当浏览器历史栈不足以返回时回退到 `/client`。

#### Scenario: 从自由练习进入后返回
- **WHEN** 学生从自由练习中心点击某模块进入 StageSelector
- **THEN** 返回按钮点击后回到自由练习中心

#### Scenario: 直接 URL 访问的兜底
- **WHEN** 学生直接输入 URL 访问 StageSelector，`window.history.length <= 1`
- **THEN** 返回按钮点击后导航到 `/client`（使用 `{ replace: true }`），不离开 app

### Requirement: Learning Home CSS Styles
系统 SHALL 在 `index.css` 中定义学习首页（`.learning-home`）、自由练习（`.free-page`、`.free-grid`、`.free-card`）、冒险地图（`.adventure-game-page`、`.adventure-quest-board`、`.adventure-quest-card`）、CMS 排关编辑器（`.adventure-cms-page`）的样式类，并为 ≤920px 宽度提供响应式适配。

#### Scenario: 响应式适配
- **WHEN** 视口宽度 ≤ 920px
- **THEN** 首页网格和自由练习网格 MUST 变为单列布局，关卡卡片和相关元素大小 MUST 响应缩小
