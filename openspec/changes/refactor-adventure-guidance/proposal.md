# Change: Refactor Adventure Stage Guidance

## Why
当前"学习指导"功能存在三个问题：

1. **学生端冒险关卡看不到指导**：`InteractiveQuiz` 通过 `customStages.find(cs => cs.id === stageId)` 查找 guidance，冒险关卡 ID 格式为 `adventure_route_xxx`，永远匹配不上，导致学习指导在冒险模式下从未生效。
2. **关卡说明和指导混在一起**：`AdventureStage.description` 身兼两职（卡片文字 + 指导内容），语义不清。
3. **图片存储非结构化**：图片 URL 直接嵌入 Markdown 字符串，无法独立管理和清理。

本次改造将：
- 把学习指导的编辑入口从"关卡编排"移到"主线编排"
- 为冒险关卡增加独立的学习指导字段
- 新建图片表，结构化存储指导中的图片
- 修复学生端指导展示

## What Changes

### Data Model
- `AdventureStage` 接口新增 `guidance?: string`（学习指导 Markdown，用 `{image:id}` 占位符引用图片）
- `AdventureStage` 接口新增 `guidanceImages?: GuidanceImage[]`（图片列表）
- 新建 `adventure_guidance_images` 数据库表
- `adventure_routes` 表新增 `guidance TEXT`、`guidance_images JSONB DEFAULT '[]'` 列
- `AutoStage` 接口新增 `guidance`、`guidanceImages` 字段

### CMS — 主线编排（AdventureEditor）
- 编辑按钮改弹框：标题 + 关卡说明 + 学习指导（Markdown textarea + 图片上传 + 图片列表管理 + 预览）
- `addToRoute()` 时 description 和 guidance 都为空（教师手动填写）
- 编辑后自动同步（不等"发布路线"按钮）

### CMS — 关卡编排（CustomStageEditor）
- **移除**学习指导和图片上传功能
- **移除**关卡列表中的"📖 含指导"标签

### 共享组件
- 提取 `GuidanceEditor` 共享组件（textarea + 图片上传 + 预览）
- `uploadGuidanceImage()` 改为上传后同时写入 `adventure_guidance_images` 表

### 学生端
- 冒险关卡进入时每次弹 GuidanceModal
- 移除"不再提示"复选框
- 修复 guidance 查找逻辑：识别 `adventure_route_` 前缀，从 AdventureStage 读取

## Impact
- **Affected specs**: `adventure-path`（MODIFIED）, `stage-guidance`（MODIFIED）, `quiz-practice`（MODIFIED）
- **New files**: `src/components/GuidanceEditor.tsx`, SQL migration
- **Modified files**: `useAppStore.ts`, `AdventureEditor.tsx`, `CustomStageEditor.tsx`, `SupabaseStorageProvider.ts`, `InteractiveQuiz.tsx`, `GuidanceModal.tsx`, `guidanceImageUpload.ts`, `syncOps.ts`, `index.css`
- **New DB table**: `adventure_guidance_images`
- **Modified DB table**: `adventure_routes`（+guidance, +guidance_images）
