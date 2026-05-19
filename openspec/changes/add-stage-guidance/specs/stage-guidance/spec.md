## ADDED Requirements

### Requirement: Stage Guidance Data Model
关卡数据 SHALL 支持携带一段可选的"学习指导"Markdown 文本。教师创建或编辑关卡时可选填，学生进入关卡前看到。空字符串或 `undefined` 视为"无指导"。

#### Scenario: 类型字段
- **WHEN** 在 `src/core/store/useAppStore.ts` 的 `CustomStage` 接口上读取
- **THEN** `guidance` MUST 是 `string | undefined` 的可选字段

#### Scenario: 持久化向后兼容
- **WHEN** 已存在的关卡（旧 localStorage 数据，无 `guidance` 字段）被加载
- **THEN** 系统 MUST 正常 hydrate，且该关卡视为"无指导"

#### Scenario: Preset 重新生成保留 guidance
- **WHEN** 教师对某模块点「生成预设关卡」按钮（调用 `generatePresetStages(moduleId)`），且该模块旧 preset 关卡中有些已经填写了 `guidance`
- **THEN** 新生成的 preset 关卡中，与旧 preset 关卡 id（形如 `auto_${moduleId}_stage_${N}`）相同者 MUST 沿用旧 `guidance`；新增的 preset 关卡 `guidance` 为 `undefined`

### Requirement: Teacher Guidance Editor
教师端 `CustomStageEditor`（管理后台 → 关卡编排）SHALL 在「关卡名称」与「选择题目」之间提供一个多行 Markdown 输入区，支持 GitHub Flavored Markdown 的常见语法（粗体、斜体、列表、链接、行内代码、标题），并在输入区下方提供实时渲染预览。

#### Scenario: 新建关卡填写指导
- **WHEN** 教师在新建关卡表单中填入名称、勾选题目，并在「学习指导」textarea 中输入 Markdown 文本
- **THEN** 保存后该关卡的 `guidance` 字段 MUST 等于输入的 trim 后字符串；若 trim 后为空字符串则 MUST 存为 `undefined`

#### Scenario: 编辑关卡修改指导
- **WHEN** 教师点已有关卡的「编辑」，进入编辑模式
- **THEN** 「学习指导」textarea MUST 展示该关卡当前的 `guidance`（无 guidance 则空白），且保存时 MUST 更新为新值

#### Scenario: Preset 关卡也可编辑指导
- **WHEN** 教师对一个带 `isPreset: true` 的预设关卡点「编辑」
- **THEN** 教师 MUST 可在不取消预设的前提下编辑并保存其 `guidance`；同一编辑表单中关卡名称与题目勾选区 MUST 处于 disabled 状态（仅 `guidance` 可改）；保存时 MUST NOT 修改该关卡的 `title`、`sliceIds`、`isPreset`

#### Scenario: 关卡列表同时显示预设与手动
- **WHEN** 教师查看「当前模块的所有关卡」列表
- **THEN** 该列表 MUST 同时显示该模块的预设关卡与手动关卡，每行 MUST 提供「编辑」入口；预设行 MUST 带视觉标记（如 🔒 预设 标签）以与手动关卡区分

#### Scenario: 实时预览
- **WHEN** 教师在 textarea 输入非空文本
- **THEN** 输入区下方 MUST 实时显示用 react-markdown 渲染的预览

#### Scenario: 关卡列表展开查看指导
- **WHEN** 教师在「当前模块的手动关卡」列表点某关卡的「查看」
- **THEN** 展开区 MUST 在题目列表上方展示该关卡 `guidance` 的渲染结果（若有）

### Requirement: Student Guidance Modal
学生在闯关模式下点进任一关卡时，若该关卡的 `guidance` 非空，则 `InteractiveQuiz` SHALL 先渲染一个全屏蒙层 `GuidanceModal`，以 react-markdown 渲染指导文本，并 MUST 阻塞 quiz 渲染（不消费题目、不启动计时、不发声）直到用户点「开始答题」。`guidance` 为空 / `undefined` 时 MUST 跳过蒙层直接进入 quiz。

#### Scenario: 有 guidance 时弹出蒙层
- **WHEN** 学生从 StageSelector 点击 `guidance` 非空的关卡，到达 `/client/quiz/<stageId>`
- **THEN** 页面 MUST 渲染全屏蒙层（深色背景 + 居中卡片），卡片含关卡名、Markdown 渲染的 guidance 与「开始答题」按钮；quiz 题目区 MUST NOT 渲染

#### Scenario: 点开始答题进入 quiz
- **WHEN** 学生在蒙层中点击「开始答题」按钮
- **THEN** 蒙层 MUST 关闭，且本路由会话内 MUST 切换到原本的 quiz 渲染流程

#### Scenario: 无 guidance 时不弹蒙层
- **WHEN** 学生进入一个 `guidance` 为空字符串或 `undefined` 的关卡
- **THEN** 页面 MUST 直接渲染 quiz，不出现蒙层

#### Scenario: 蒙层背景与 Esc 不关闭
- **WHEN** 学生点击蒙层背景（卡片之外的暗色区域）或按下 Esc
- **THEN** 蒙层 MUST 保持开启；仅「开始答题」按钮 MUST 触发关闭

#### Scenario: 刷新或重进关卡重弹（默认）
- **WHEN** 学生进入某关、关闭蒙层（未勾「不再提示」）、刷新页面或退出后再次进入同一关
- **THEN** 蒙层 MUST 再次出现

#### Scenario: 「不再提示」复选框抑制
- **WHEN** 学生在蒙层底部勾选「不再提示」后点「开始答题」
- **THEN** 系统 MUST 在 `localStorage` 的 `stage_guidance_suppressed` 键下，以 `{ [stageId]: 当前 guidance 全文 }` 形式记录快照；下次进入同一 stage 且其 `guidance` 与快照严格相等时 MUST 跳过蒙层直接进入 quiz

#### Scenario: 老师更新 guidance 后自动重弹
- **WHEN** 学生曾对某 stage 勾选过「不再提示」，老师随后修改了该 stage 的 `guidance`（导致字符串与抑制快照不再相等），学生再次进入该 stage
- **THEN** 蒙层 MUST 重新弹出（自动忽略过期快照），学生看到新内容后可再次选择是否抑制

#### Scenario: Markdown 渲染范围
- **WHEN** guidance 包含 GFM 语法（粗体、斜体、无序/有序列表、链接、行内代码、标题 1-3 级）
- **THEN** 蒙层 MUST 用 `react-markdown` + `remark-gfm` 渲染为对应 DOM 元素；MUST NOT 解析原始 HTML 标签（默认安全行为）

#### Scenario: 响应式布局
- **WHEN** 学生在不同视口打开蒙层
- **THEN** 卡片在 ≥ 768px 视口 MUST 不超过 640px 宽并居中；在 480-767px MUST 自适应（宽度 = 视口宽 - 32px）；在 < 480px MUST 自适应（宽度 = 视口宽 - 24px）且「开始答题」按钮 MUST 全宽；内容区 MUST 在内容过长时纵向滚动（`max-height: 60vh`）

#### Scenario: 按钮触摸友好
- **WHEN** 「开始答题」按钮在任意视口被渲染
- **THEN** 按钮可点击高度 MUST ≥ 44px
