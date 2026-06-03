## Context

学习指导功能在 v1 版本中只绑定了 `CustomStage`，通过 `addToRoute()` 复制到 `AdventureStage.description`。现在需要将其正式变为冒险关卡的独立属性，并分离"卡片说明"和"学习指导"两个语义。

## Goals / Non-Goals

### Goals
- `AdventureStage` 拥有独立的 `guidance` 和 `guidanceImages` 字段
- 学习指导编辑入口只在 AdventureEditor（弹框）
- 图片独立存储到 `adventure_guidance_images` 表
- 学生端每次进冒险关卡都弹指导（无复选框）
- 编辑指导后自动同步到 Supabase

### Non-Goals
- 不做孤儿图片自动清理（保留后续 admin 工具）
- 不改动自由练习模式（CustomStage.guidance 保留，但不再在 UI 中编辑）
- 不改动现有 Stages 表的 guidance 列

## Decisions

### Decision 1: Guidance 存储方式
- **Decision**: guidance 用 TEXT 存 Markdown（含 `{image:id}` 占位符），图片元数据独立存 `adventure_guidance_images` 表
- **Why**: 结构化图片数据便于管理（删除、查询、迁移），同时保持 Markdown 内容灵活
- **Alternatives considered**:
  - JSONB 合并存 text + images：查询不便，自定义协议复杂
  - 纯 TEXT 嵌入 URL：无法独立管理图片
  - 纯结构化编辑器（TipTap/Quill）：太重，300KB+ bundle

### Decision 2: 图片引用方式
- **Decision**: Markdown 中用 `{image:<id>}` 占位符引用，渲染时替换为图片表的 public_url
- **Why**: URL 不硬编码在 Markdown 中，换存储换域名只需改图片表
- **Note**: 向下兼容——旧数据的 `![alt](url)` 格式仍能正常渲染（因为 url 没变）

### Decision 3: 编辑弹框
- **Decision**: AdventureEditor 的编辑按钮改为全功能弹框（不是行内编辑）
- **Why**: 弹框能容纳标题、说明、指导文字、图片上传、图片列表、预览等多个区域

### Decision 4: addToRoute 行为
- **Decision**: `description = ''`、`guidance = ''`，都不从源关卡复制
- **Why**: 语义分离后，卡片说明和指导都是冒险关卡的独立属性，教师应手动填写

### Decision 5: 同步方式
- **Decision**: 不做增量同步。编辑只保存到 store（localStorage），点击"发布路线"时才全量写入 Supabase
- **Why**: 
  - `adventure_routes` 的 publish 流程是全量删+插，没有稳定唯一键给增量 upsert
  - 增量和全量双写路径会冲突（一个写 guidance，另一个全量删+插时可能丢失）
  - 教师已习惯"改完点发布"的工作流（主线编排页面上方有发布栏）
  - 与 `add-adventure-learning-path` spec 中 "AdventureEditor 不单独写数据库" 的设计一致
- **Alternatives considered**:
  - 加 `stage_id UNIQUE` 列做增量 upsert：解决唯一键问题，但双写冲突仍需处理
  - 增量写后标记脏数据，全量发布时合并：复杂度太高

### Decision 6: 学生端展示
- **Decision**: 所有关卡（冒险 + 自由练习）都每次弹 GuidanceModal，全局移除复选框和 suppression 逻辑
- **Why**: 需求明确要求重复进入都提示；统一行为减少维护成本

### Decision 7: CustomStageEditor 改动
- **Decision**: 彻底移除 guidance 编辑相关 UI
- **Why**: 编辑入口移至 AdventureEditor，CustomStage 只保留数据层面的 `guidance` 字段供自由练习模式使用（自由练习不经过冒险路线，但仍需能读 guidance）

## Data Model

```typescript
// AdventureStage 新增字段
export interface GuidanceImage {
  id: string;           // 短 ID，如 "img_a1b2c3d4"
  url: string;          // 完整 public URL
  alt?: string;         // alt 文本
  fileSize?: number;    // 文件大小（字节）
}

export interface AdventureStage {
  id: string;
  title: string;
  description?: string;          // 关卡卡片说明（冒险地图上显示的）
  guidance?: string;             // 学习指导 Markdown，用 {image:id} 引用图片
  guidanceImages?: GuidanceImage[];  // 图片列表
  levelNum: number;
  sourceStageId: string;
  sourceModule: QuizModuleId;
  questionCount: number;
  unlockRule: 'previous_clear';
  source?: 'manual' | 'assistant';
  createdAt?: number;
  updatedAt?: number;
}
```

## Risks / Trade-offs

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| 旧数据 `description` 含 guidance 内容 | High | 迁移 SQL 将 `description` 复制到 `guidance`，教师可后续清理 |
| 自由练习模式无法编辑指导 | Medium | CustomStage.guidance 数据层面保留，只移除 UI 编辑入口 |
| 图片表与 Storage 不一致 | Low | 上传时双写（Storage + DB）；删除时只删 DB 记录，Storage 文件留待 admin 工具处理 |
| 学生端旧 suppression 记录变脏 | Low | 改造后无复选框，suppression 逻辑整体移除 |

## Migration Plan

1. 创建 SQL migration：`adventure_routes` 加列 + 新建 `adventure_guidance_images` 表
2. 迁移现有数据：`UPDATE adventure_routes SET guidance = description WHERE guidance IS NULL`
3. 修改数据层：`useAppStore.ts` 类型 + store actions（`??` 替代 `||`，description 不再 fallback 到 guidance）
4. 修改存储层：`SupabaseStorageProvider` save/load
5. `guidanceImageUpload.ts`：返回类型改为 `{ url: string; imageId: string }`，上传后写入 `adventure_guidance_images` 表
6. 提取共享组件：`GuidanceEditor.tsx`
7. 改造 AdventureEditor：弹框 + 学习指导编辑
8. 改造 CustomStageEditor：移除指导相关内容
9. 修复学生端 GuidanceModal 和 InteractiveQuiz：修复弹框触发条件、支持 `{image:id}` 渲染、全局移除复选框和 suppression
10. 测试验证：`npm test` + `npm run build`
