## 1. 依赖与类型
- [x] 1.1 安装 `react-markdown` 与 `remark-gfm`：`npm i react-markdown remark-gfm`
- [x] 1.2 在 `src/core/store/useAppStore.ts` 的 `CustomStage` 接口加 `guidance?: string`
- [x] 1.3 在 `generatePresetStages` 中，重新生成 preset 前用 `Map<id, guidance>` 缓存旧 preset 的 guidance，生成后按 id 还原

## 2. GuidanceModal 组件（TDD）
- [x] 2.1 在 `src/components/GuidanceModal.test.tsx` 写失败测试（纯文本、加粗、列表、链接、按钮回调、不响应背景点击）
- [x] 2.2 实现 `src/components/GuidanceModal.tsx`：全屏蒙层 + 居中卡片 + ReactMarkdown 渲染 + 「开始答题」按钮 + 响应式样式
- [x] 2.3 `npx vitest run src/components/GuidanceModal.test.tsx` 全绿

## 3. 学生端接入
- [x] 3.1 在 `src/pages/client/InteractiveQuiz.tsx` 顶部读取当前 stage 的 `guidance`，加 `introDismissed` 本地状态
- [x] 3.2 若 `!introDismissed && guidance.trim()` 早 return `<GuidanceModal />`
- [x] 3.3 手工：进入有 guidance 的关 → 看到蒙层；进入空 guidance 的关 → 直接进 quiz
- [x] 3.4 手工：刷新页面 → 蒙层重弹

## 4. 教师端接入
- [x] 4.1 在 `CustomStageEditor` 加 `const [guidance, setGuidance] = useState('')`
- [x] 4.2 在关卡名称下方插入 textarea + 实时预览（`<details open>`）
- [x] 4.3 `handleCreate` / `handleUpdate` 把 `guidance: guidance.trim() || undefined` 带上
- [x] 4.4 `handleEdit` 进入编辑模式时 `setGuidance(cs.guidance ?? '')`
- [x] 4.5 `handleCancel` 和保存成功后 `setGuidance('')`
- [x] 4.6 关卡列表「查看」展开区追加 guidance 渲染（如有）
- [x] 4.7 「当前模块的手动关卡」区改名「当前模块的所有关卡」，过滤改为 `cs.module === module`（去掉 `!cs.isPreset`），preset 行加 `🔒 预设` 标签
- [x] 4.8 进入编辑模式时若 stage 为 preset，关卡名称 input 与题目勾选区 disabled，附说明文字「预设关卡的题目由系统自动生成，不可修改」
- [x] 4.9 `handleUpdate` 中若 editing 的是 preset，仅更新 `guidance` 字段，不动 `title` / `sliceIds` / `isPreset`

## 5. 响应式 & 测试
- [x] 5.1 GuidanceModal 在 PC（≥1024px）、iPad（≥768px）、iPhone（≤480px）三个视口下布局正常
- [x] 5.2 教师端 textarea 在三个视口下不挤压
- [x] 5.3 `npm test` 全绿、`npm run build` 通过
- [x] 5.4 手动测试清单（见 design.md §6.3）

## 6. 验证
- [x] 6.1 `openspec validate add-stage-guidance --strict` 通过

## 7. 提交
- [x] 7.1 单一 PR 提交，标题：`feat(stages): 闯关模式增加学习指导 (#14)`
- [x] 7.2 Closes #14
