## 1. 数据库迁移
- [ ] 1.1 创建 `docs/supabase/migration_add_adventure_routes_guidance.sql`：`adventure_routes` 加 `guidance TEXT`、`guidance_images JSONB DEFAULT '[]'` 列
- [ ] 1.2 创建 `docs/supabase/migration_create_adventure_guidance_images.sql`：新建 `adventure_guidance_images` 表（id, stage_id, storage_path, public_url, alt_text, file_size, created_at）
- [ ] 1.3 迁移现有数据：`UPDATE adventure_routes SET guidance = description WHERE guidance IS NULL`

## 2. 数据模型 & Store
- [ ] 2.1 `useAppStore.ts`：定义 `GuidanceImage` 接口
- [ ] 2.2 `useAppStore.ts`：`AdventureStage` 加 `guidance?: string`、`guidanceImages?: GuidanceImage[]`
- [ ] 2.3 `useAppStore.ts`：`AutoStage` 加 `guidance`、`guidanceImages` 字段
- [ ] 2.4 `useAppStore.ts`：更新 `getAdventureStages()` 返回 guidance（fallback 链：`stage.guidance || sourceStage.guidance || stage.description || ''`）
- [ ] 2.5 `useAppStore.ts`：更新 `addAdventureStage()` 接受 guidance 和 guidanceImages

## 3. 存储层同步
- [ ] 3.1 `SupabaseStorageProvider.ts`：`save()` 写入 guidance + guidanceImages 到 adventure_routes
- [ ] 3.2 `SupabaseStorageProvider.ts`：`load()` 读取 guidance + guidanceImages 从 adventure_routes

## 4. 共享组件：GuidanceEditor
- [ ] 4.1 新建 `src/components/GuidanceEditor.tsx`：从 CustomStageEditor 提取
- [ ] 4.2 封装 textarea + ref（光标位置管理）
- [ ] 4.3 封装 `insertAtCursor()` 插入 `{image:id}` 占位符
- [ ] 4.4 封装 `runUpload()` 上传图片（调用 uploadGuidanceImage + 写入图片表）
- [ ] 4.5 封装 paste 事件处理（拦截 image/* 自动上传）
- [ ] 4.6 封装 drag-and-drop 事件处理
- [ ] 4.7 封装文件选择按钮
- [ ] 4.8 封装上传状态显示（idle / uploading / error）
- [ ] 4.9 封装 Markdown 预览（ReactMarkdown + 图片占位符解析）
- [ ] 4.10 `guidanceImageUpload.ts`：上传后同时写入 `adventure_guidance_images` 表

## 5. 主线编排改造（AdventureEditor）
- [ ] 5.1 创建编辑弹框组件（标题 + description + guidance + 图片列表 + 预览）
- [ ] 5.2 弹框集成 `GuidanceEditor` 组件
- [ ] 5.3 弹框中显示已上传图片列表（可删除）
- [ ] 5.4 `addToRoute()` 改为 description = ''、guidance = ''
- [ ] 5.5 弹框保存后只写 store（localStorage），发布依赖"发布路线"按钮
- [ ] 5.6 关卡列表显示"📖 含指导"标签（如有 guidance）

## 6. 关卡编排改造（CustomStageEditor）
- [ ] 6.1 移除学习指导 textarea 和图片上传相关 UI
- [ ] 6.2 移除关卡列表中的"📖 含指导"标签
- [ ] 6.3 移除相关 state（guidance, uploadStatus, textareaRef, fileInputRef）

## 7. 学生端改造
- [ ] 7.1 `InteractiveQuiz.tsx`：修复弹框触发条件（`stageRecord` 对冒险关卡为 null 的问题）
- [ ] 7.2 `InteractiveQuiz.tsx`：修复 guidance 查找（识别 `adventure_route_` 前缀，从 getAdventureStages 读取）
- [ ] 7.3 `GuidanceModal.tsx`：全局移除"不再提示"复选框和所有 suppression 逻辑
- [ ] 7.4 `InteractiveQuiz.tsx`：全局移除 `readSuppressedMap()`、`writeSuppressed()`、`GUIDANCE_SUPPRESS_KEY`
- [ ] 7.5 `InteractiveQuiz.tsx`：Markdown 渲染支持 `{image:id}` 占位符解析（同时兼容旧 `![alt](url)` 格式）

## 8. 验证
- [ ] 8.1 `npm test` 全绿
- [ ] 8.2 `npm run build` 通过
- [ ] 8.3 `openspec validate refactor-adventure-guidance --strict` 通过
