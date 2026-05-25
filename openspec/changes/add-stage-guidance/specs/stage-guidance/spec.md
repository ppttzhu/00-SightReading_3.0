## ADDED Requirements

### Requirement: Stage Guidance Data Model
关卡数据 SHALL 支持携带一段可选的"学习指导"Markdown 文本，持久化到 Supabase `public.stages` 表的 `guidance` 列。教师创建或编辑关卡时可选填，学生进入关卡前看到。NULL / 空字符串 / `undefined` 视为"无指导"。

#### Scenario: 数据库列
- **WHEN** 执行 `docs/supabase/migration_add_stage_guidance.sql`
- **THEN** `public.stages` 表 MUST 拥有可空列 `guidance TEXT`；迁移 MUST 幂等（`ADD COLUMN IF NOT EXISTS`）

#### Scenario: 客户端类型字段
- **WHEN** 在 `src/core/store/useAppStore.ts` 的 `CustomStage` 接口上读取
- **THEN** `guidance` MUST 是 `string | undefined` 的可选字段

#### Scenario: Supabase 往返
- **WHEN** 教师在 `CustomStageEditor` 保存带 guidance 的关卡，触发 `SupabaseStorageProvider.save()` → 之后任意客户端调用 `SupabaseStorageProvider.load()`
- **THEN** load 后的 `CustomStage.guidance` MUST 与保存前完全一致（DB `null` MUST 映回 JS `undefined`）

#### Scenario: 向后兼容旧行
- **WHEN** 加载 migration 前已经存在的 `stages` 行（`guidance IS NULL`）
- **THEN** 客户端 MUST 视为"无指导"，UI 行为 = 跳过蒙层

### Requirement: Stage Guidance Image Storage
教师在「学习指导」textarea 上传的图片 SHALL 通过 Supabase Storage 存储在专用 bucket `stage-guidance-images` 中，public 读 / admin 写。

#### Scenario: Bucket 与策略创建
- **WHEN** 执行 `docs/supabase/migration_create_guidance_images_bucket.sql`
- **THEN** Supabase Storage MUST 拥有名为 `stage-guidance-images` 的 public bucket；MUST 拥有 RLS 策略：任何 role 可 SELECT、仅 `profiles.role = 'admin'` 可 INSERT / DELETE

#### Scenario: 上传文件类型限制
- **WHEN** 教师在客户端调用 `uploadGuidanceImage(file)`，且 `file.type` 不以 `image/` 开头
- **THEN** 函数 MUST 抛 `GuidanceImageUploadError`，且 MUST NOT 发起任何网络请求

#### Scenario: 上传文件大小限制
- **WHEN** 教师上传一个 > 5 MB 的图片
- **THEN** 函数 MUST 抛 `GuidanceImageUploadError`，且 MUST NOT 发起任何网络请求

#### Scenario: 上传成功返回 public URL
- **WHEN** 上传一张合法图片
- **THEN** 函数 MUST 在 bucket 中以唯一随机路径（`{uuid}.{ext}`）写入文件，并 MUST 返回 `getPublicUrl()` 给出的 URL；该 URL 在未登录学生端 `<img>` 标签里 MUST 直接可见

### Requirement: Teacher Guidance Editor
教师端 `CustomStageEditor`（管理后台 → 关卡编排）SHALL 在「关卡名称 + 题数」行下方提供一个多行 Markdown 输入区，支持 GFM + soft-break（单回车即换行）+ 图片上传，并在输入区下方提供实时渲染预览。

#### Scenario: 新建关卡填写指导
- **WHEN** 教师在新建关卡表单中填入名称、勾选题目，并在「学习指导」textarea 中输入 Markdown 文本
- **THEN** 保存后该关卡的 `guidance` 字段 MUST 等于输入的 trim 后字符串；若 trim 后为空字符串则 MUST 存为 `undefined`（向 Supabase 序列化为 `null`）

#### Scenario: 编辑关卡修改指导
- **WHEN** 教师点已有关卡的「编辑」，进入编辑模式
- **THEN** 「学习指导」textarea MUST 展示该关卡当前的 `guidance`（无 guidance 则空白）；保存时 MUST 更新为新值

#### Scenario: 实时预览（含 markdown + 换行 + 图片）
- **WHEN** 教师在 textarea 输入非空文本
- **THEN** 输入区下方「预览」展开区 MUST 用 `react-markdown` + `remark-gfm` + `remark-breaks` 实时渲染：粗体、列表、链接、行内代码、标题、**单回车视为 `<br>`**、**`![alt](url)` 渲染为受约束 `<img>`**

#### Scenario: 点击按钮上传图片
- **WHEN** 教师点击「📷 插入图片」按钮，选择本地图片文件
- **THEN** 系统 MUST 调用 `uploadGuidanceImage(file)` 上传，成功后 MUST 在 textarea 的当前光标位置插入 `![{file.name}]({publicUrl})`

#### Scenario: 拖拽上传图片
- **WHEN** 教师将一个或多个 image/* 文件拖拽到 textarea 上
- **THEN** textarea MUST 拦截 drop 事件（preventDefault），对每个图片文件依次调用上传流程并按顺序插入 markdown 到光标位置

#### Scenario: 粘贴上传图片
- **WHEN** 教师在 textarea 内 paste 时 clipboardData 含 image/*（如系统截图）
- **THEN** textarea MUST 拦截 paste（preventDefault），上传剪贴板里的图片并在光标位置插入 markdown

#### Scenario: 上传失败提示
- **WHEN** 上传过程中 `uploadGuidanceImage` 抛出 `GuidanceImageUploadError`
- **THEN** UI MUST 显示明确的错误信息（错误文案、文件名），且 MUST NOT 在 textarea 注入任何 markdown

#### Scenario: 列表「📖 含指导」标签
- **WHEN** 关卡列表中某行对应的 stage 有非空 `guidance`
- **THEN** 该行 MUST 显示一个 `📖 含指导` 视觉标签

### Requirement: Student Guidance Modal
学生在闯关模式下点进任一关卡时，若该关卡的 `guidance` 非空，则 `InteractiveQuiz` SHALL 先渲染一个全屏蒙层 `GuidanceModal`，以 react-markdown 渲染指导文本，并 MUST 阻塞 quiz 渲染（不消费题目、不启动计时、不发声）直到用户点「开始答题」。`guidance` 为空 / `undefined` 时 MUST 跳过蒙层直接进入 quiz。

#### Scenario: 有 guidance 时弹出蒙层
- **WHEN** 学生从 StageSelector 点击 `guidance` 非空的关卡，到达 `/client/quiz/<stageId>`
- **THEN** 页面 MUST 渲染全屏蒙层（深色背景 + 居中卡片），卡片含关卡名、markdown 渲染的 guidance 与「开始答题」按钮；quiz 题目区 MUST NOT 渲染

#### Scenario: 点开始答题进入 quiz
- **WHEN** 学生在蒙层中点击「开始答题」按钮
- **THEN** 蒙层 MUST 关闭，且 InteractiveQuiz MUST 在同一 mount 内切换到原本的 quiz 渲染流程，VexFlow 五线谱 MUST 正确渲染到 `containerRef`

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
- **THEN** 系统 MUST 在 `localStorage` 的 `stage_guidance_suppressed` 键下，以 `{ [stageId]: 当前 guidance 全文 }` 形式记录快照；下次进入同一 stage 且其 `guidance` 与快照严格相等时 MUST 跳过蒙层直接进入 quiz；localStorage 写入失败（Safari Private / quota）MUST 静默忽略，不阻塞用户

#### Scenario: 老师更新 guidance 后自动重弹
- **WHEN** 学生曾对某 stage 勾选过「不再提示」，老师随后修改了该 stage 的 `guidance`（导致字符串与抑制快照不再相等），学生再次进入该 stage
- **THEN** 蒙层 MUST 重新弹出（自动忽略过期快照）

#### Scenario: Markdown 渲染范围（含换行 + 图片）
- **WHEN** guidance 含 GFM 语法、单回车、`![alt](url)` 图片
- **THEN** 蒙层 MUST 用 `react-markdown` + `remark-gfm` + `remark-breaks` 渲染：标准 markdown 元素 + 单 `\n` 渲染为 `<br>` + 图片渲染为 `<img>`（max-width 100%、height auto、border-radius 8px）；MUST NOT 解析原始 HTML 标签（默认安全行为）

#### Scenario: 响应式布局
- **WHEN** 学生在不同视口打开蒙层
- **THEN** 卡片在 ≥ 768px 视口 MUST 不超过 640px 宽并居中；在 480-767px MUST 自适应（宽度 = 视口宽 - 32px）；在 < 480px MUST 自适应（宽度 = 视口宽 - 24px）；内容区 MUST 在内容过长时纵向滚动（`max-height: 60vh`）

#### Scenario: 按钮触摸友好
- **WHEN** 「开始答题」按钮在任意视口被渲染
- **THEN** 按钮可点击高度 MUST ≥ 44px
