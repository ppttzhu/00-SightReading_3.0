# Change: 闯关模式增加"学习指导"功能

## Why
Issue [#14](https://github.com/ppttzhu/00-SightReading_3.0/issues/14)：闯关模式每一关开始前老师需要向学生展示一段"学习指导"文字；教师端的关卡设置里需要一个输入框来填写。学生端 UI 必须在 PC、iPhone/Android phone、iPad/Android tablet 三种视口都合理。

当前 `CustomStage` 没有任何文本字段可用于这一目的，关卡进入流程也没有任何前置介绍页。本 change 在数据模型上加一个可选的 `guidance: string`（Markdown），在教师端 `CustomStageEditor` 增加多行 Markdown 输入与实时预览，在学生端 `InteractiveQuiz` 增加进入关卡时的全屏 Markdown 蒙层，点「开始答题」后再进入 quiz。

## What Changes
- **ADDED** `Stage Guidance Data Model`：`CustomStage` 增加可选字段 `guidance?: string`，向后兼容；preset 关卡重新生成时按 id 保留 guidance。
- **ADDED** `Teacher Guidance Editor`：`CustomStageEditor` 新增"学习指导"多行输入与预览，新建/编辑/查看流程均贯通。
- **ADDED** `Student Guidance Modal`：进入闯关 quiz 时，若该关卡有非空 `guidance`，渲染全屏 Markdown 蒙层并阻塞 quiz 直至用户点「开始答题」；guidance 为空 / undefined 直接跳过蒙层进入 quiz。

## Impact
- Affected specs: 新增 `stage-guidance` capability
- Affected code:
  - `src/core/store/useAppStore.ts`（CustomStage 类型 + generatePresetStages 保留逻辑）
  - `src/pages/cms/CustomStageEditor.tsx`（教师端输入 + 预览 + 列表展开区）
  - `src/pages/client/InteractiveQuiz.tsx`（学生端早 return GuidanceModal）
  - `src/components/GuidanceModal.tsx`（新组件）
- 新依赖：`react-markdown@^9`、`remark-gfm@^4`（约 +30KB gzipped）
- 测试：`src/components/GuidanceModal.test.tsx`（新增 vitest 用例）
- 数据迁移：不需要（字段可选，旧关卡自然为 undefined）
