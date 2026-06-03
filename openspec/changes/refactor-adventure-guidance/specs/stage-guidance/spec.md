## MODIFIED Requirements

### Requirement: Teacher Guidance Editor
教师端学习指导编辑器 SHALL 在"主线编排"（AdventureEditor）的关卡编辑弹框中提供，而非"关卡编排"（CustomStageEditor）。编辑器 SHALL 包含 Markdown textarea（支持 GFM + soft-break + 图片占位符 `{image:id}`）、图片上传（点击/拖拽/粘贴）、和实时渲染预览。

#### Scenario: 编辑入口在主线编排
- **WHEN** 教师在主线编排页面点编辑按钮
- **THEN** MUST 弹出编辑弹框，其中包含：
  - 关卡标题输入框
  - 关卡说明输入框（描述文字，显示在闯关地图卡片上）
  - 学习指导 textarea（支持 Markdown）
  - 📷 上传图片按钮
  - 已上传图片列表（可删除）
  - 👁 Markdown 预览（可折叠）

#### Scenario: 弹框保存后存 store
- **WHEN** 教师在弹框中修改 guidance 并点击"保存修改"
- **THEN** 新值 MUST 写入 store（zustand persist 自动存 localStorage）
- **AND** MUST NOT 触发数据库写入；持久化依赖"发布路线"按钮的全量 publish

#### Scenario: 图片上传流程
- **WHEN** 教师通过拖拽/粘贴/点击上传图片
- **THEN** 系统 MUST 调用 `uploadGuidanceImage(file)` 上传到 Supabase Storage
- **AND** 写入 `adventure_guidance_images` 表
- **AND** 在 textarea 当前光标位置插入 `{image:<id>}` 占位符

#### Scenario: 已上传图片管理
- **WHEN** 弹框中的图片列表区域显示
- **THEN**  MUST 展示当前关卡的所有已上传图片（缩略图 + alt 文本 + 删除按钮）
- **WHEN** 教师点击删除按钮
- **THEN** 系统 MUST 从 `adventure_guidance_images` 表删除记录
- **AND** 从 `stage.guidanceImages` 中移除
- **AND** 从 `adventure_guidance_images` 表删除记录
- **AND** MUST NOT 删除 Supabase Storage 中的原始文件（保留孤儿清理给后续 admin 工具）
- **AND** 通知教师"图片已从关卡移除，如需彻底删除文件请使用 Storage 管理工具"

#### Scenario: 关卡列表指导标签
- **WHEN** 主线路线的关卡列表渲染时
- **THEN** 若该关卡有非空 `guidance`，MUST 显示 `📖 含指导` 视觉标签

## REMOVED Requirements

### Requirement: Stage Guidance Data Model（CustomStage 部分）
**Reason**: learning guidance 编辑移至 AdventureEditor，CustomStage 不再维护 guidance 的编辑 UI。CustomStage.guidance 数据字段保留供自由练习模式读取，但不再在 CustomStageEditor 中展示和编辑。

**Migration**: 
- CustomStageEditor 移除 textarea、图片上传、预览、paste/drop 事件、上传状态
- 移除关卡列表中的 "📖 含指导" 标签
- 移除相关 state：`guidance`、`uploadStatus`、`textareaRef`、`fileInputRef`

### Requirement: Teacher Guidance Editor（CustomStageEditor 部分）
**Reason**: 编辑入口移到 AdventureEditor。

**Migration**: 移除 CustomStageEditor 中从 "学习指导" label 到预览 details 的整段 UI（约 90 行）

### Requirement: [不再提示] 复选框
**Reason**: 需求改为每次进关卡都弹指导，无需复选框。

**Migration**: 
- `GuidanceModal.tsx` 移除 checkbox、`dontShowAgain` state、`onStart` 参数
- `InteractiveQuiz.tsx` 移除 `readSuppressedMap()`、`writeSuppressed()`、`GUIDANCE_SUPPRESS_KEY`
- 每次有 guidance 且关卡匹配成功就弹指导
