# Change: 闯关模式增加"学习指导"功能（v2，Supabase 适配 + 图片上传 + 换行）

## Why
Issue [#14](https://github.com/ppttzhu/00-SightReading_3.0/issues/14)：闯关模式每一关开始前老师需要向学生展示一段"学习指导"文字；教师端的关卡设置里需要一个输入框来填写。学生端 UI 必须在 PC、iPhone/Android phone、iPad/Android tablet 三种视口都合理。

v1 提案（PR #16）在 main 分支 PR #17（Supabase 迁移）之前实现，关卡数据走 zustand persist；现在 stage 数据已搬到 Supabase `public.stages` 表，guidance 也必须落表才能跨设备一致。Reviewer 反馈后老师补了两个新需求：

1. **文字能换行** —— CommonMark 默认单回车不算换行，需要 `remark-breaks` 插件让老师按 Enter 直接换行
2. **图片上传** —— 老师能上传图片到学习指导，自动插入 markdown，学生端能看到

本 change 实现这三件事的合集：guidance 列存 Supabase + 图片 bucket + remark-breaks 渲染。

## What Changes
- **ADDED** `Stage Guidance Data Model`：`stages` 表新增 `guidance TEXT` 列；`CustomStage.guidance?: string`；`SupabaseStorageProvider` 与 `syncOps` 双向往返。
- **ADDED** `Stage Guidance Image Storage`：Supabase Storage bucket `stage-guidance-images`（public 读，admin 写）+ RLS；客户端 `uploadGuidanceImage(file)` helper（type/size 限制 + 唯一路径）。
- **ADDED** `Teacher Guidance Editor`：`CustomStageEditor` 加 textarea + 实时预览 + 「📷 插入图片」按钮 + 拖拽 + 粘贴上传 + 「📖 含指导」列表标签。
- **ADDED** `Student Guidance Modal`：进入闯关 quiz 时若 guidance 非空，渲染全屏 markdown 蒙层（支持 GFM + 软换行 + 图片）；「不再提示」 + 老师改 guidance 自动重弹。

## Impact
- Affected specs: 新增 `stage-guidance` capability
- Affected code:
  - `src/core/store/useAppStore.ts`（`CustomStage.guidance?: string` + 加宽 `updateCustomStage` patch 类型）
  - `src/core/storage/SupabaseStorageProvider.ts`（StageRow 加 guidance + save/load 映射）
  - `src/core/storage/syncOps.ts`（并行写路径加 guidance）
  - `src/pages/cms/CustomStageEditor.tsx`（textarea + 预览 + 图片上传 UI + paste/drop 处理 + 标签）
  - `src/pages/client/InteractiveQuiz.tsx`（早 return GuidanceModal + suppression + introDismissed 加进 VexFlow/blink useEffect 依赖）
  - `src/components/GuidanceModal.tsx`（新，含 markdown + 换行 + 图片 + Esc 锁）
  - `src/components/guidanceImageUpload.ts`（新，上传 helper）
- 新增 SQL：
  - `docs/supabase/migration_add_stage_guidance.sql` (加列)
  - `docs/supabase/migration_create_guidance_images_bucket.sql` (建 bucket + RLS)
- 新增依赖：`react-markdown@^9`、`remark-gfm@^4`、`remark-breaks@^4`、`@testing-library/react`、`@testing-library/jest-dom`、`jsdom`
- 测试：`src/components/GuidanceModal.test.tsx` 11 例（含 markdown / 换行 / 图片 / Esc / 抑制按钮 / 背景点击）
- 数据迁移：不需要回填（旧 stages 行 `guidance` 为 NULL，客户端视为无指导）

## Deployment Steps
1. Merge PR 前在 Supabase Dashboard SQL Editor 顺序跑两个 migration：
   - `docs/supabase/migration_add_stage_guidance.sql`
   - `docs/supabase/migration_create_guidance_images_bucket.sql`
2. Merge PR
3. Cloudflare Pages 自动 deploy

PR 描述里会再次列出。
