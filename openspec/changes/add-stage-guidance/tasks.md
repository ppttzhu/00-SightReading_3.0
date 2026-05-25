## 1. 依赖与工具链
- [x] 1.1 `npm i react-markdown@^9 remark-gfm@^4 remark-breaks@^4`
- [x] 1.2 `npm i -D @testing-library/react @testing-library/jest-dom jsdom`
- [x] 1.3 `vite.config.ts`：`defineConfig` 改从 `vitest/config` 引入，加 `test: { environment: 'jsdom' }`

## 2. 数据库
- [x] 2.1 `docs/supabase/migration_add_stage_guidance.sql`：`ALTER TABLE stages ADD COLUMN IF NOT EXISTS guidance TEXT`
- [x] 2.2 `docs/supabase/migration_create_guidance_images_bucket.sql`：创建 `stage-guidance-images` public bucket + 3 条 RLS（public read / admin insert / admin delete）

## 3. 客户端数据层
- [x] 3.1 `CustomStage` 加 `guidance?: string`
- [x] 3.2 加宽 `updateCustomStage` 签名为 `Partial<CustomStage>`
- [x] 3.3 `SupabaseStorageProvider.save()` 写 `guidance: stage.guidance ?? null`
- [x] 3.4 `SupabaseStorageProvider.load()` SELECT 加 `guidance` 列，DB `null` → JS `undefined`
- [x] 3.5 `syncOps.ts` 并行写路径同步加 `guidance`

## 4. 上传 helper
- [x] 4.1 `src/components/guidanceImageUpload.ts`：导出 `uploadGuidanceImage(file)` + `GuidanceImageUploadError`
- [x] 4.2 校验 type 必须 `image/*`、size ≤ 2 MB（先验后上传）
- [x] 4.3 路径 `{randomUUID}.{ext}`；返回 `getPublicUrl()` URL

## 5. GuidanceModal 组件（TDD）
- [x] 5.1 `src/components/GuidanceModal.test.tsx`：11 例
- [x] 5.2 `src/components/GuidanceModal.tsx`：markdown（remark-gfm + remark-breaks）+ img 约束（max-width 100%）+ Esc / 背景点击 lock + 「不再提示」 + 「开始答题」
- [x] 5.3 全绿（11/11）

## 6. 学生端 InteractiveQuiz 接入
- [x] 6.1 helper：`readSuppressedMap` / `writeSuppressed`（key `stage_guidance_suppressed`）
- [x] 6.2 读 stageRecord、guidance；用 lazy initializer 比较快照决定 `introDismissed` 初值
- [x] 6.3 早 return `<GuidanceModal>`（必须在所有 hooks 之后）
- [x] 6.4 VexFlow 渲染 useEffect 和闪烁 useEffect 的依赖数组加上 `introDismissed`

## 7. 教师端 CustomStageEditor 接入
- [ ] 7.1 加 `const [guidance, setGuidance] = useState('')`
- [ ] 7.2 textarea + 「📷 插入图片」按钮 + 文字下方 details 预览（react-markdown + remark-gfm + remark-breaks，img 约束）
- [ ] 7.3 paste 处理：clipboardData 里有 image/* 时 preventDefault + 上传 + 光标位置插入 markdown
- [ ] 7.4 drop 处理：dragover preventDefault；drop 收 image/* 文件依次上传 + 插入
- [ ] 7.5 `handleCreate` / `handleEdit` / `handleUpdate` / `handleCancel` 同步 guidance state
- [ ] 7.6 关卡列表行加 `📖 含指导` 标签（如有 guidance）
- [ ] 7.7 关卡展开/查看区顶部渲染 guidance（如有）
- [ ] 7.8 上传错误用 inline 文案或浏览器 alert 提示

## 8. 文档 & OpenSpec
- [x] 8.1 `docs/superpowers/specs/2026-05-25-stage-guidance-v2-design.md` v2 设计文档
- [x] 8.2 OpenSpec proposal + delta spec + tasks 更新到 v2
- [ ] 8.3 `openspec validate add-stage-guidance --strict` 通过

## 9. 验证与提交
- [ ] 9.1 `npm test` 全绿（≥ 131）
- [ ] 9.2 `npm run build` 通过
- [ ] 9.3 关闭 PR #16，开新 PR：`feat(stages): 闯关模式增加学习指导 (#14, Supabase-adapted)`
- [ ] 9.4 PR body 中显式列出两个 SQL migration 文件（reviewer 在 merge 前手动执行）
- [ ] 9.5 Closes #14
