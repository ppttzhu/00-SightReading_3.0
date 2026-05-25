# Stage Learning Guidance v2 — Design Spec

> Issue: [#14](https://github.com/ppttzhu/00-SightReading_3.0/issues/14)
> Supersedes: [v1 spec](2026-05-18-stage-guidance-design.md) + PR #16 (closing)
> Date: 2026-05-25
> Author: bearpaw

## 1. Goal

在闯关模式下，学生点开任一关卡后，先看到老师为该关卡撰写的「学习指导」（Markdown，**支持换行 + 图片**），点「开始答题」后再进入 quiz。教师端关卡编辑器提供 markdown textarea + 实时预览 + **图片上传**，PC、平板、手机三端 UI 均合理。

**与 v1 的差别**：
- 数据从 zustand persist（localStorage）迁到 **Supabase `stages` 表新列 `guidance`**（main 上 PR #17 已经迁移）
- 不再有 preset 关卡概念（main 上 `434c833` 移除了"生成预设关卡"），所有关卡都是手动；删除 v1 的 preset 编辑锁、preset 重新生成保留逻辑、preset 列表合并等复杂度
- 新增「**回车即换行**」支持（remark-breaks 插件）
- 新增「**图片上传**」支持（点击 / 拖拽 / 粘贴 → Supabase Storage → 自动插入 markdown）

**非目标**：
- 不为「练习模式 / 自由练习 / 音程练习」加指导（没有关卡概念）
- 不做"模块级默认指导 + 关卡覆盖"双层结构
- 不做图片裁剪 / 旋转 / 大小调整 UI（老师上传前自己处理）
- 不做图片孤儿清理 UI（删除 guidance 不会删除其引用的图片；可单独写一个 admin 工具，本次不做）

## 2. Scope

| 范围 | 包含 |
|---|---|
| 关卡来源 | Supabase `stages` 表里 `del_status = false` 的所有行 |
| 模块 | notes / symbols / theory / patterns 全部 4 个 |
| 文本格式 | GitHub-Flavored Markdown + **soft-break-as-line-break**（remark-gfm + remark-breaks） |
| 图片来源 | 教师本地文件上传（image/*，≤ 5 MB） → Supabase Storage bucket `stage-guidance-images`（public 读，admin 写） |
| 抑制状态 | 学生 localStorage `stage_guidance_suppressed[stageId] = guidance 全文快照` |

## 3. Data Model

### 3.1 数据库

**Migration A**：在 `public.stages` 表添加可空列：

```sql
ALTER TABLE public.stages ADD COLUMN IF NOT EXISTS guidance TEXT;
```

向后兼容：现有行 `guidance` 默认 NULL，老客户端不会受影响。

**Migration B**：创建 Storage bucket + RLS：

```sql
-- bucket（public 读）
insert into storage.buckets (id, name, public)
values ('stage-guidance-images', 'stage-guidance-images', true)
on conflict (id) do nothing;

-- 公开读
create policy "guidance_images_public_read" on storage.objects
  for select to public
  using (bucket_id = 'stage-guidance-images');

-- admin 写（参考 profiles.role）
create policy "guidance_images_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'stage-guidance-images'
              and (select role from public.profiles where id = auth.uid()) = 'admin');

-- admin 删（为后续清理预留）
create policy "guidance_images_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'stage-guidance-images'
         and (select role from public.profiles where id = auth.uid()) = 'admin');
```

### 3.2 客户端

`CustomStage` 上加可选字段：

```ts
export interface CustomStage {
  id: string;
  module: 'notes' | 'symbols' | 'theory' | 'patterns';
  title: string;
  sliceIds: string[];
  isPreset?: boolean;
  questionCount?: number;
  guidance?: string;   // markdown 文本；'' / undefined 视为无指导
}
```

`SupabaseStorageProvider.save()` 上传时 `guidance: stage.guidance ?? null`；
`SupabaseStorageProvider.load()` SELECT 时加 `guidance` 列，把 DB `null` 映回 JS `undefined`。
`syncOps.ts` 的并行写路径同步加 guidance。

## 4. Component Architecture

### 4.1 GuidanceModal

文件：`src/components/GuidanceModal.tsx`

```tsx
interface Props {
  title: string;
  guidance: string;
  onStart: (dontShowAgain: boolean) => void;
}
```

行为：

- 全屏遮罩 `position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 1000;`
- 居中卡片，PC 最大 640px，移动端宽度 = 视口宽 - 24px
- 顶部"📖 学习指导" + 关卡名
- 正文区：
  - `<ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>` 渲染
  - `<a>` override：`target="_blank" rel="noopener noreferrer"`
  - `<img>` override：`max-width: 100%; height: auto; border-radius: 8px; display: block;`
  - `max-height: 60vh; overflow-y: auto`
- 底部：左 ☐ 不再提示此关卡，右 「开始答题」按钮（minHeight 48px）
- Esc + 背景点击 **不**关闭蒙层；仅按钮关闭

### 4.2 学生端接入（InteractiveQuiz）

- 从 `useAppStore` 读 `customStages` → 找当前 stageId → 取 `guidance.trim()`
- localStorage `stage_guidance_suppressed`：`{stageId: guidance 全文}`，字符串相等才视为已抑制
- 若 `!introDismissed && guidance && stageRecord` → 早 return `<GuidanceModal>`
- 早 return 必须 **在所有 hooks 之后**
- VexFlow 渲染 useEffect 与闪烁 useEffect 的依赖数组加上 `introDismissed`，保证蒙层关闭后 ref 已挂时重跑

### 4.3 教师端接入（CustomStageEditor）

在「关卡名称 + 题数」行下方新增「学习指导」区：

- **textarea**（多行，rows=5，resize: vertical）
- 上方提示：「（可选，支持 Markdown：**加粗**、- 列表、[链接](url)、换行直接按 Enter）」
- 右上「📷 插入图片」按钮 → file picker（accept="image/*"）
- **拖拽**：textarea 接受 dragover/drop，文件 → uploadGuidanceImage → 光标位置插入 `![filename](url)`
- **粘贴**：textarea 接受 paste，clipboardData.items 里如果有 image/* → 阻止默认粘贴，走上传流程
- 上传中显示 spinner + 进度文案；失败时 alert / 内联 error
- textarea 下方「👁 预览」`<details open>`：用同样的 react-markdown 配置实时渲染（含 remark-breaks + img 约束）

关卡列表行：标题旁加 `📖 含指导`（蓝色）标签（如有非空 guidance）；展开/查看面板顶部渲染 guidance（如有）。

`handleCreate` / `handleEdit` / `handleUpdate` / `handleCancel` 都要同步 `guidance` state。

### 4.4 图片上传：`uploadGuidanceImage` helper

文件：`src/components/guidanceImageUpload.ts`（无 JSX，纯逻辑）

```ts
export class GuidanceImageUploadError extends Error {}
export async function uploadGuidanceImage(file: File): Promise<string>
```

约束：
- file.type 必须以 `image/` 开头
- file.size ≤ 5 MB
- 路径：`{randomUUID}.{ext}`（不按 stageId 分目录 —— 关卡可能改名/移动，guidance 文本中 url 是稳定 ref）
- 失败时抛 `GuidanceImageUploadError`，UI 用 `instanceof` 匹配后 toast / inline 显示
- 上传成功返回 `supabase.storage.from(bucket).getPublicUrl(path).publicUrl`

### 4.5 抑制状态

```ts
const SUPPRESS_KEY = 'stage_guidance_suppressed';
// {stageId: guidance 全文快照}
```

- 学生勾选「不再提示」后点开始 → 写入 `{[stageId]: guidance}`，下次进关 `localStorage[stageId] === guidance` → 跳过蒙层
- 老师修改 guidance → 字符串不再相等 → 重弹（无需 hash / version）
- `writeSuppressed` 包 try/catch，Safari Private 或 quota 满时静默失败（下次照常弹蒙层）

## 5. Responsive

| Breakpoint | 蒙层卡片 | 教师端 textarea |
|---|---|---|
| ≥ 768px | max-width 640px 居中 | 全宽 textarea，rows 5 |
| 480-767px | width = vw - 32px | 全宽，rows 5 |
| < 480px | width = vw - 24px、按钮全宽 | rows 5、字号 0.95rem |

图片在蒙层和预览里都受 `max-width: 100%` 约束，不会撑破布局。

## 6. Testing

### 6.1 单元测试（vitest）

`src/components/GuidanceModal.test.tsx`（已实现，11 例）：

- 标题 + 纯文本
- markdown 加粗 → `<strong>`
- markdown 列表 → `<ul><li>`
- markdown 链接 → `<a target="_blank" rel="noopener">`
- XSS 安全（`<script>` 不渲染）
- **图片 → 受约束 `<img>`**（src、alt、max-width 100%、height auto）
- **单 \n → 硬换行**（remark-breaks 验证）
- 按钮 onStart(false)
- 复选框 + 按钮 onStart(true)
- 背景点击不调用 onStart
- Esc 不调用 onStart

可考虑新增 `guidanceImageUpload.test.ts`：
- 文件类型错误 → 抛 `GuidanceImageUploadError`
- 文件过大 → 抛 `GuidanceImageUploadError`
- 成功路径用 supabase mock 验证 upload + getPublicUrl 流程（可选，本次手工验证可代替）

### 6.2 手动验收清单（学生 + 教师）

教师端：
1. 新建关卡填 markdown（含换行、加粗、列表、链接）→ 保存 → 编辑能看回原文 + 预览正确
2. 点「📷 插入图片」选本地小图（< 5MB）→ textarea 自动出现 `![name](https://...)` → 预览正确显示图片
3. 拖拽 image 到 textarea → 同 #2
4. 粘贴图片（截图 / 复制 image）→ 同 #2
5. 上传 PDF → 报错「不支持的文件类型」
6. 上传 > 5MB 图片 → 报错「图片过大」
7. 列表显示「📖 含指导」标签

学生端：
8. 进入有 guidance 的关卡 → 弹蒙层，markdown 完整渲染（换行、图片可见）
9. 勾选「不再提示」点开始 → 进 quiz
10. 刷新或重进同一关 → 不弹（被抑制）
11. 老师改 guidance 一个字符 → 学生再进 → 重弹
12. 进入没有 guidance 的关 → 直接进 quiz
13. PC / iPad / iPhone 三档视口蒙层 + 编辑器布局合理
14. 蒙层 Esc + 背景点击都不关

## 7. Risks & Mitigations

| 风险 | 缓解 |
|---|---|
| Supabase Storage 上传慢 / 失败 | 显示明确 error；不阻塞 textarea 输入 |
| 图片孤儿堆积 | 留给后续 admin 工具；bucket 是 public 读但只有 admin 能写/删 |
| 老师上传巨大图 | 客户端 5 MB 限制 + Supabase 服务端默认限制 |
| writeSuppressed 在 Safari Private 抛错 | try/catch 静默，蒙层下次正常弹 |
| 学生看到 broken image（被 admin 误删） | react-markdown 渲染 broken img 是浏览器默认行为，可接受 |

## 8. Out of Scope

- 富文本 WYSIWYG 编辑器
- 图片裁剪 / 压缩 / EXIF 删除 / 拖拽调整大小
- 视频 / 音频 / iframe embed
- 模块级默认指导
- 学生端"再看一次指导"按钮
- 图片孤儿清理 admin 工具
- 国际化（中文写死）
- 蒙层底部 a11y（role="dialog" / focus trap / autofocus）

## 9. Implementation Order

详见 `docs/superpowers/plans/2026-05-25-stage-guidance-v2-supabase.md`。简述：

1. 依赖 + 配置：`react-markdown`、`remark-gfm`、`remark-breaks`、`jsdom`、testing-library，vite.config 切到 vitest/config
2. SQL 迁移：`migration_add_stage_guidance.sql` + `migration_create_guidance_images_bucket.sql`
3. 数据层：`CustomStage.guidance` + `SupabaseStorageProvider` + `syncOps`
4. 上传 helper：`guidanceImageUpload.ts`
5. GuidanceModal 组件（TDD，11 例）
6. InteractiveQuiz 接入
7. CustomStageEditor 接入（textarea + 预览 + 上传 UI + paste/drop）
8. 文档 + OpenSpec
9. PR
