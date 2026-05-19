# Stage Learning Guidance — Design Spec

> Issue: [#14](https://github.com/ppttzhu/00-SightReading_3.0/issues/14) — 闯关模式每关开始前展示老师写的"学习指导"，教师端关卡设置加输入框。
> Date: 2026-05-18
> Author: bearpaw

## 1. Goal

在闯关模式下，学生点开任一关卡后，先看到老师为该关卡撰写的「学习指导」（Markdown 文本），点「开始答题」后再进入 quiz。教师端关卡编辑器提供对应的多行 Markdown 输入框，PC、平板、手机三端 UI 均合理。

非目标：

- 不为「练习模式 / 自由练习 / 音程练习」加指导（没有关卡概念）。
- 不做"模块级默认指导 + 关卡覆盖"的双层结构（YAGNI）。

蒙层支持「不再提示」复选框：

- 学生勾选后点「开始答题」→ localStorage 存 `{stageId: 当前 guidance 全文快照}`
- 下次进关时：若 `snapshot === 当前 stage.guidance` 则跳过蒙层；否则照常弹（自动检测到老师改了内容）
- 没勾选 → 不写 localStorage、下次还会弹

## 2. Scope

| 范围 | 包含 |
|---|---|
| 关卡来源 | `customStages` 中的 **所有** 关卡（手动 + preset 自动）|
| 模块 | notes / symbols / theory / patterns 全部 4 个 |
| 数据迁移 | 不需要 —— `guidance` 字段可选，旧关卡 `undefined`，行为 = 跳过蒙层 |

## 3. Data Model

在 `src/core/store/useAppStore.ts` 的 `CustomStage` 上加一个可选字段：

```ts
export type CustomStage = {
  id: string;
  module: string;
  title: string;
  sliceIds: string[];
  isPreset?: boolean;
  guidance?: string;   // markdown 文本；空字符串 / undefined 视为无指导
};
```

- 沿用现有 `addCustomStage`、`updateCustomStage`（`Partial<CustomStage>`）签名，无需新 action。
- 走现有 zustand persist（localStorage）通道，无需迁移脚本。
- `generatePresetStages` 生成 preset 关卡时不主动写 `guidance`（保持 undefined，等老师填）。

## 4. Component Architecture

### 4.1 New component: `GuidanceModal`

文件：`src/components/GuidanceModal.tsx`

```tsx
interface Props {
  title: string;        // 关卡名（顶部小标题）
  guidance: string;     // markdown 源
  onStart: (dontShowAgain: boolean) => void;  // 点「开始答题」回调，参数为复选框状态
}
```

行为：

- 全屏遮罩 `position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 1000;`
- 居中卡片：圆角 16px、白底、阴影
- **不**响应点蒙层背景关闭、**不**响应 Esc 关闭（避免误触跳过指导）
- 顶部：小字「学习指导」+ 关卡名（粗体）
- 正文：`<ReactMarkdown remarkPlugins={[remarkGfm]}>{guidance}</ReactMarkdown>`，内容区 `max-height: 60vh; overflow-y: auto`
- 底部：左侧 `☐ 不再提示此关卡` 复选框（本地 state），右侧主按钮「开始答题」（高 ≥48px）
- 点按钮 → `onStart(dontShowAgain)`

### 4.2 Markdown 渲染

- 新依赖：`react-markdown` ^9、`remark-gfm` ^4
- 安全：`react-markdown` 默认不解析原始 HTML，无需手动 sanitize
- 支持：粗体、斜体、列表（有序/无序）、链接（`target="_blank"` 由 components 配置）、行内代码、标题
- 不支持图片（YAGNI；如需后续单独加）

### 4.3 InteractiveQuiz 接入

在 `src/pages/client/InteractiveQuiz.tsx` 顶部读取当前 stage 的 `guidance`，配合 localStorage 抑制状态：

```tsx
const SUPPRESS_KEY = 'stage_guidance_suppressed';

function readSuppressed(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(SUPPRESS_KEY) ?? '{}'); }
  catch { return {}; }
}

function writeSuppressed(stageId: string, guidanceSnapshot: string) {
  const map = readSuppressed();
  map[stageId] = guidanceSnapshot;
  localStorage.setItem(SUPPRESS_KEY, JSON.stringify(map));
}

// 在组件中：
const stage = useAppStore(s => s.customStages.find(cs => cs.id === stageId));
const guidance = stage?.guidance?.trim() ?? '';
const suppressed = readSuppressed()[stageId ?? ''] === guidance;
const [introDismissed, setIntroDismissed] = useState(suppressed);
const showGuidance = !introDismissed && guidance.length > 0;

if (showGuidance) {
  return (
    <GuidanceModal
      title={stage!.title}
      guidance={guidance}
      onStart={(dontShowAgain) => {
        if (dontShowAgain) writeSuppressed(stageId!, guidance);
        setIntroDismissed(true);
      }}
    />
  );
}
// ... 原本的 quiz 渲染
```

关键点：

- **早 return** —— 学生看完指导前 quiz 不挂载，不消费题、不开始任何计时/音频副作用
- `suppressed` 在 mount 时读一次 localStorage；快照与当前 guidance 字符串严格相等才视为已抑制
- 老师改了 guidance → 快照失效 → 自动重弹
- 关卡没填 guidance → `showGuidance = false`，与现有行为一致
- 学生没勾「不再提示」→ 不写 localStorage → 下次照常弹

### 4.4 CustomStageEditor 改动

文件：`src/pages/cms/CustomStageEditor.tsx`

#### 4.4.1 表单字段（同表单双用）

「编辑」按钮对**所有**关卡可用，包括 preset。编辑 preset 时：

- 模块按钮：已经在编辑态下 disabled（现有逻辑，无需改）
- 关卡名称 `<input>`：`disabled={editingId && currentlyEditingPreset}`
- 题目勾选区：`disabled`，整块半透明蒙层 + 说明文字「预设关卡的题目由系统自动生成，不可修改；如需调整请先取消预设」
- **学习指导 textarea**：始终可编辑

`handleUpdate` 保存时：preset 关卡只更新 `guidance`（不动 `title`、`sliceIds`、`isPreset`），manual 关卡更新全部三项（如现状）。

「当前模块的手动关卡」区改名为「**当前模块的所有关卡**」，过滤改为 `cs.module === module`（去掉 `!cs.isPreset`）。preset 行视觉上加 `🔒 预设` 标签区分。

#### 4.4.2 字段位置（关卡名称下方、题目上方）

在「关卡名称」`<input>` 下方、「选择题目」上方插入：

```tsx
<div style={{ marginBottom: '18px' }}>
  <label>学习指导 <span style={{ color: '#9ca3af', fontWeight: 400 }}>（可选，支持 Markdown）</span></label>
  <textarea
    value={guidance}
    onChange={e => setGuidance(e.target.value)}
    rows={6}
    placeholder="例如：&#10;这一关主要练习升降号。&#10;&#10;**注意**：C# 和 Db 是同一个键。"
  />
  {guidance.trim() && (
    <details open>
      <summary>预览</summary>
      <div className="md-preview">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{guidance}</ReactMarkdown>
      </div>
    </details>
  )}
</div>
```

- 加局部 state `const [guidance, setGuidance] = useState('')`
- `handleCreate`：把 `guidance: guidance.trim() || undefined` 加进新 `CustomStage`
- `handleUpdate`：把 `guidance: guidance.trim() || undefined` 传给 `updateCustomStage`
- `handleEdit`：进入编辑模式时 `setGuidance(cs.guidance ?? '')`
- `handleCancel`、保存成功后：`setGuidance('')`

关卡列表「查看」展开区里追加一行（如有 guidance）：

```tsx
{cs.guidance?.trim() && (
  <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '8px', marginBottom: '8px' }}>
    <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: '4px' }}>📖 学习指导</div>
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{cs.guidance}</ReactMarkdown>
  </div>
)}
```

## 5. Responsive Layout

| Breakpoint | 蒙层卡片 | 教师端 textarea |
|---|---|---|
| ≥ 768px (desktop/iPad) | `max-width: 640px`、padding 32px、文字 1rem | 全宽 textarea、rows=6 |
| 480-767px (大手机/小平板) | `width: calc(100vw - 32px)`、padding 24px | 全宽 textarea、rows=5 |
| < 480px (手机) | `width: calc(100vw - 24px)`、padding 16px、按钮全宽 | rows=5、字号 0.95rem |

实现方式：内联样式 + `window.matchMedia` 监听，或简单用 CSS `@media`（推荐 CSS）。先用 CSS 媒体查询配合 className，避免 SSR/初始尺寸问题。

## 6. Testing

### 6.1 单元测试（vitest）

`src/components/GuidanceModal.test.tsx`：

- 渲染纯文本：`{guidance: "hello"}` → DOM 含 "hello"
- 渲染 markdown 粗体：`"**bold**"` → 含 `<strong>bold</strong>`
- 渲染列表：`"- a\n- b"` → 含 `<ul><li>a</li><li>b</li></ul>`
- 渲染链接：`"[x](https://e.com)"` → 含 `<a href="https://e.com">`
- 点「开始答题」→ `onStart(false)` 被调用（默认未勾选）
- 勾选「不再提示」后点「开始答题」→ `onStart(true)` 被调用
- 不响应背景点击：模拟点击蒙层背景元素 → `onStart` 不被调用

### 6.2 集成行为（手工）

- InteractiveQuiz 在有 guidance 时早 return GuidanceModal → 不渲染 quiz
- 点开始 → 切到 quiz，无副作用泄漏

InteractiveQuiz 现有测试不动；不为本次改动新增 quiz 集成测试（行为简单，手工足够）。

### 6.3 手动验收清单

1. ✅ 教师创建关卡时填 markdown guidance → 保存 → 重新打开看到内容
2. ✅ 预览区实时显示 markdown 渲染结果
3. ✅ 学生进有 guidance 的关 → 弹蒙层、markdown 正确渲染、点开始进 quiz
4. ✅ 学生进**没填** guidance 的关 → 不弹蒙层，直接进 quiz
5. ✅ 同一关重复进入 → 每次都弹
6. ✅ 链接可点击且新标签打开
7. ✅ PC（≥1024px）、iPad（≥768px）、iPhone（≤480px）三种视口下蒙层与编辑器布局都合理
8. ✅ Preset 关卡也能编辑 guidance（不必先取消预设）

## 7. Out of Scope

- 图片 / 视频 / 嵌入
- 富文本 WYSIWYG 编辑器
- 已读状态记忆
- 多语言 i18n
- 模块级默认指导
- 学生端"再看一次指导"按钮（如真需要后续再加）

## 8. Risks & Mitigations

| 风险 | 缓解 |
|---|---|
| react-markdown bundle 体积 +30KB | 接受；功能价值 > 体积 |
| 教师误写 markdown 语法 | 预览区实时展示 + 不渲染原始 HTML（XSS 安全） |
| guidance 太长占满屏 | 内容区 `max-height: 60vh` + scroll |
| Preset 关卡被`generatePresetStages` 重新生成时 guidance 丢失 | `generatePresetStages` 当前实现：先 `filter` 掉旧 preset（行 205-207）再插入新生成的。preset id 是 `auto_${moduleId}_stage_${N}`，稳定但题目内容可能变。修复：生成前先存 `Map<id, guidance>`，新 preset 中同 id 的恢复 guidance。教师"重新生成"的语义不变，但学习指导会跟随同号关卡保留 |

## 9. Implementation Order

1. 加依赖（`react-markdown`、`remark-gfm`）
2. 扩展 `CustomStage` 类型
3. `generatePresetStages` 保留旧 guidance（如适用）
4. 写 `GuidanceModal` 组件 + 单元测试（TDD）
5. 接入 `InteractiveQuiz`
6. 接入 `CustomStageEditor`（textarea + 预览 + 列表展开区）
7. 手工跑过验收清单
8. 提 PR

Implementation plan 会用 superpowers writing-plans 详细展开。

## 10. Local Testing Workaround

`/cms/*` 走 Supabase auth gate（`CMSAuthGate`），本地无 env 时进不去。

**为了开发期测试**，临时在 `src/components/auth/CMSAuthGate.tsx` 顶部加一行：

```tsx
if (import.meta.env.DEV) return <>{children}</>;
```

**重要**：

- 这行**不进入** feature PR
- 实现时单独 commit、PR 前 revert，或者用 `git stash`/`git checkout --` 本地丢弃
- 自动化测试不依赖此改动（vitest 不需要）

后续如果团队希望本地有更顺滑的 dev 体验，可单独提"dev-mode CMS bypass"的 PR，本次不混入。
