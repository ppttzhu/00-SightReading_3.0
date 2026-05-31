## Context

学生需要一条由教师编排的线性学习路线，能混合不同题型模块（单音、双音/音程等），并在学生端以游戏化地图呈现。教师端需要能对现有关卡排序、查看状态、使用 AI 辅助生成路线草稿。

约束：
- 不破坏现有 `customStages` 模型的向后兼容性
- 冒险进度独立于四模块的 `studentProgress`
- 教师未排关时，学生端不展示骨架路线，仅显示空状态

## Goals / Non-Goals

### Goals
- 定义 `AdventureStage` 数据模型，独立于 `CustomStage`
- 数据库持久化冒险路线配置
- 教师端手动/辅助排关工具
- 学生端冒险地图展示 + 独立进度解锁
- 冒险关卡答题完成后推进进度

### Non-Goals
- 不涉及三分钟一组 session 计时
- 不涉及排行榜与竞技
- 不涉及抖音式沉浸上下滑刷题
- 不涉及多语言 / i18n

## Decisions

### Decision 1: AdventureStage 独立于 CustomStage
- **决策**：`AdventureStage` 作为独立类型，不与 `CustomStage` 合并，通过 `sourceStageId` 软引用
- **理由**：
  - `CustomStage` 是按模块归类的（module='notes' 等），冒险路线混合题型，语义不同
  - 独立模型允许未来扩展路线专属字段（如建议练习时长、通关分数要求）而不影响现有关卡
  - 软引用避免数据冗余：删除 customStage 不影响 adventureStages 数组结构
- **替代方案**：`CustomStage.module = 'adventure'`——混合路线的关卡本质不再是某个模块的关卡，强行归入会污染 module 语义

### Decision 2: 数据库持久化使用独立表 `adventure_paths`
- **决策**：新增 `adventure_paths` 表，而非在现有 `stages` 表中加列
- **理由**：
  - `stages` 表是 single stage 级别数据，`adventure_paths` 存储的是**路线编排**（一个数组 + 排序），粒度不同
  - 独立表可以存储完整 JSON（整个路线数组），避免关联查询
- **模式**：
  ```sql
  CREATE TABLE IF NOT EXISTS adventure_paths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stages JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ```
  `stages` 列存储完整的 `AdventureStage[]` 数组 JSONB

### Decision 3: 进度追踪改用 stageId 集合，不同步 Supabase
- **决策**：冒险进度使用 `adventureCompletedStageIds: string[]` 记录已完成的 stage ID，而非用数字 `studentProgress.adventure`。进度仅存在本地 store（zustand persist 自动处理），不同步 Supabase `student_progress` 表
- **理由**：
  - 数字进度（`levelNum < progress`）在教师重排冒险关卡后静默错位——旧序号对应新关卡，学生会看到没打过的关卡标记为已完成。stageId 集合不受排序变化影响
  - 解锁逻辑改为 `prevStageId in completedStageIds`，与关卡位置解耦
- **将来**：如需跨设备同步，可新增 `adventure_progress` 表独立处理

### Decision 5: InteractiveQuiz 冒险关卡检测
- **决策**：在 `InteractiveQuiz.tsx` 中，在现有 `stageId.split('_')` 解析逻辑之前，增加 `stageId.startsWith('adventure_route_')` 前缀检测。命中前缀时直接走 `getAdventureStages()` 匹配路径，不走 split 逻辑
- **理由**：
  - 冒险 ID 格式 `adventure_route_${timestamp}_${sourceStageId}` 含多个 `_`，现有 split 逻辑会错误解析出 `moduleId = 'route'`，导致 `getAllStages('route')` 返回空数组
  - 前缀检测是独立分支，不影响现有 custom / auto 关卡的解析路径
- **替代方案**：修改 ID 格式去掉下划线——但会破坏存量数据兼容性

### Decision 6: StageSelector 返回使用 navigate(-1) 带兜底
- **决策**：返回按钮使用 `navigate(-1)`，但添加 `window.history.length > 1` 检查，否则回退到 `navigate('/client', { replace: true })`
- **理由**：直接 URL 访问时 history 栈深度不足，`navigate(-1)` 会离开 app
- **影响文件**：`src/pages/client/StageSelector.tsx`

### Decision 7: AdventureMap 需要加载态与错误态
- **决策**：AdventureMap 中数据加载过程展示 spinner，查询失败时展示错误提示 + 重试按钮
- **理由**：`adventure_paths` 查询涉及网络往返，无加载态会导致 FOEC（空内容闪烁）；无错误态会让网络故障表现为"空路线"，误导学生以为教师没排关
- **决策**：`adventureStages.length === 0` 时，AdventureMap 显示空状态提示，不展示硬编码骨架路线
- **理由**：硬编码预设会产生预期落差（学生看到"坐标单音"但老师还没排关），且教学内容应由教师决定而非代码硬写

## Data Model

```typescript
export type QuizModuleId = Slice['module']; // 'notes' | 'theory' | 'symbols' | 'patterns'

export interface AdventureStage {
  id: string;                       // "adventure_route_${timestamp}_${sourceStageId}"
  title: string;
  description?: string;
  levelNum: number;                 // 排序序号，自动维护
  sourceStageId?: string;           // 引用 customStages 中的关卡 ID
  sourceModule?: QuizModuleId;      // 来源模块
  sliceIds: string[];               // 直接引用 slicesPool 的 ID（无 sourceStage 时兜底）
  questionCount: number;
  unlockRule: 'previous_clear';     // 统一规则：通关上一关后解锁
  source: 'manual' | 'assistant';   // 手动添加 vs AI 生成
  createdAt?: number;
  updatedAt?: number;
}
```

## Sync Strategy

```typescript
// StageData 新增字段（可选，向后兼容）
interface StageData {
  slicesPool: Slice[];
  customStages: CustomStage[];
  adventureStages?: AdventureStage[];  // ADDED
  updatedAt: string;
}
```

- 加载时 `data.adventureStages || []`
- 发布时携带 `state.adventureStages` — Publish 按钮作为统一持久化入口，根据当前后端（Cloudflare / Supabase）自动适配写入方式
- AdventureEditor **不单独写数据库**，只更新 store。和 CustomStageEditor 一致：编辑 → store → Publish → 后端
- Cloudflare 后端：`adventureStages` 作为 `StageData` 的一部分写入 KV
- Supabase 后端：`adventureStages` 写入 `adventure_paths` 表，`StageData.adventureStages` 作为 publish JSON 的向后兼容字段保留但不作为主存储
- 冒险进度 `adventureCompletedStageIds` 仅存在本地 store，不同步 Supabase

## Soft Delete Awareness

删除 `CustomStage` 时，检查是否有 `AdventureStage` 通过 `sourceStageId` 引用它：
- 如有引用：阻止删除并提示"以下冒险关卡正在引用此关卡：xxx"
- 允许教师先移除冒险引用再删除
- 不实现级联删除（避免误操作）

## Risks / Trade-offs

- **软引用 → 引用失效风险**：被引用的 customStage 可能被删除或修改 sliceIds。`AdventureStage` 中保留 `sliceIds` 副本作为兜底，但兜底数据不会随 sourceStage 的 sliceIds 变化而刷新——这是引用不复制的好处，也是风险
- **性能**：三层查找（adventureStages → customStages → slicesPool），但数据量小（<100 stages, <500 slices），非性能瓶颈
- **数据库只存一条记录**：`adventure_paths` 表只有单行，不适合未来多路线场景。如需要多路线，需重构为每行对应一个关卡的路由方案
- **并发编辑**：两个教师同时打开 AdventureEditor 时，后保存的操作会覆盖前一个——但该项目为单教师使用场景，MVP 不处理该风险
- **进度重排错位已规避**：通过 stageId 集合追踪进度，教师重排关卡后学生的已完成记录不会错位

## Migration Plan

1. 执行 SQL 迁移创建 `adventure_paths` 表
2. 无数据迁移：新表初始为空
3. 代码中加载冒险数据时先检查 `adventure_paths` 表，再回退到本地 `StageData.adventureStages`

## Open Questions

- 多路线支持（未来可以有多套冒险路线吗？比如"入门路线"和"进阶路线"）——暂不考虑，MVP 只支持单路线
