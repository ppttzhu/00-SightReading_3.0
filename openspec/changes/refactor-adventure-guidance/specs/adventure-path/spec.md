## MODIFIED Requirements

### Requirement: Adventure Stage Data Model
系统 SHALL 定义 `AdventureStage` 数据模型，独立于 `CustomStage`，通过 `sourceStageId` 软引用现有关卡。该类型 SHALL 包含 `id`、`title`、`description`、`guidance`、`guidanceImages`、`levelNum`、`sourceStageId`、`sourceModule`、`questionCount`、`unlockRule`、`source`、`createdAt`、`updatedAt` 字段。

#### Scenario: AdventureStage 类型定义
- **WHEN** 在 `useAppStore.ts` 中定义类型
- **THEN** `AdventureStage` MUST 包含以下字段：
  - `id: string` — 唯一标识，格式 `adventure_route_${sourceStageId}_${index}`
  - `title: string` — 关卡标题
  - `description?: string` — 关卡卡片说明（显示在冒险地图卡片上），与 guidance 独立
  - `guidance?: string` — 学习指导 Markdown 文本，用 `{image:id}` 占位符引用图片
  - `guidanceImages?: GuidanceImage[]` — 学习指导中引用的图片列表
  - `levelNum: number` — 排序序号，自动维护
  - `sourceStageId?: string` — 引用 `customStages` 中的关卡 ID
  - `sourceModule?: QuizModuleId` — 来源模块
  - `questionCount: number` — 题目数量
  - `unlockRule: 'previous_clear'` — 统一解锁规则
  - `source: 'manual' | 'assistant'` — 来源标记
  - `createdAt?: number` — 创建时间戳
  - `updatedAt?: number` — 更新时间戳

#### Scenario: GuidanceImage 类型定义
- **WHEN** 在 `useAppStore.ts` 中定义类型
- **THEN** `GuidanceImage` MUST 包含以下字段：
  - `id: string` — 短 ID，如 `"img_a1b2c3d4"`
  - `url: string` — 完整 public URL
  - `alt?: string` — alt 文本
  - `fileSize?: number` — 文件大小（字节）

#### Scenario: guidance 占位符解析
- **WHEN** 渲染 `guidance` 文本时遇到 `{image:<id>}` 格式
- **THEN** 系统 MUST 在 `guidanceImages` 中查找匹配 ID，替换为真实 `<img>` 标签
- **WHEN** `{image:<id>}` 在 `guidanceImages` 中找不到匹配
- **THEN** 系统 MUST 渲染为原始文本（不崩溃）

#### Scenario: getAdventureStages 返回 guidance
- **WHEN** `getAdventureStages()` 调用
- **THEN** 返回的 `AutoStage` 中 `guidance` MUST 按以下优先级链解析：`stage.guidance ?? sourceStage.guidance ?? ''`
- **AND** `guidanceImages` MUST 优先使用 `stage.guidanceImages`，为空时使用 `[]`
- **AND** `description` MUST 仅返回 `stage.description`，MUST NOT 回退到 `sourceStage.guidance`

## ADDED Requirements

### Requirement: Adventure Guidance Images Table
系统 SHALL 通过 `adventure_guidance_images` 表持久化学习指导中的图片元数据。该表 SHALL 包含每张图片的唯一 ID、所属关卡、存储路径、public URL、alt 文本、文件大小。

#### Scenario: 数据库表结构
- **WHEN** 执行数据库迁移 SQL
- **THEN** `adventure_guidance_images` 表 MUST 存在，包含列：
  - `id TEXT PRIMARY KEY` — 图片 ID（如 `"img_a1b2c3d4"`）
  - `stage_id TEXT NOT NULL` — 关联的冒险关卡 ID
  - `storage_path TEXT NOT NULL` — Supabase Storage 路径
  - `public_url TEXT NOT NULL` — 完整可访问 URL
  - `alt_text TEXT DEFAULT ''` — alt 文本
  - `file_size INTEGER DEFAULT 0` — 文件大小（字节）
  - `created_at TIMESTAMPTZ DEFAULT now()`

#### Scenario: addToRoute 不复制 guidance
- **WHEN** 教师点击"加入主线"将 `CustomStage` 加入冒险路线
- **THEN** 新增的 `AdventureStage` 的 `description` MUST 为 `''`
- **AND** `guidance` MUST 为 `''`
- **AND** `guidanceImages` MUST 为 `[]`
