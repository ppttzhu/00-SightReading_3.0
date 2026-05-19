## Context

### 现有代码模式
- Notes 练习模式入口在 `StageSelector.tsx:32-168`（"练习模式" toggle + 音域输入 + 开始按钮）
- 纯音练习渲染在 `PracticeQuiz.tsx`：单全音符 + 选项按钮
- 闯关模式共用 `InteractiveQuiz.tsx`：按 type 分支渲染 A/B/C/D 四类
- VexFlow C 类已有旋律音程渲染（双二分音符并排，`InteractiveQuiz.tsx:238-256`）
- 谱号判定复用 `PracticeQuiz.tsx:73-81` 的 `getClef()` 中点逻辑

### 约束
- 不修改现有闯关模式逻辑
- 不引入新的路由参数模式（使用 query params 传参，与 `PracticeQuiz` 一致）
- 仅使用单谱表（不加线过多可接受），暂不引入大谱表

## Goals / Non-Goals

### Goals
- 规则随机生成音程题目，永不穷尽
- 支持旋律音程 + 和声音程两种渲染
- 用户可配置音程类型、方向、谱号、音程模式
- 与现有 UI 风格一致（卡片、选项按钮、反馈动画）
- 错误时展示音程弧线标注

### Non-Goals
- 大谱表（Grand Staff）渲染
- 调号上下文参数
- 音程类型多选（下拉单选即可）
- 难度自适应
- 修改现有闯关模式

## Decisions

### 生成算法
```
generateInterval(type, direction, clefPref):
  1. 根据 type 确定半音数范围（如"三度"→ [3,4]）
  2. 随机选方向（若 direction=随机）
  3. 反推起始音合法范围：确保目标音不超出 C2-C7
  4. 随机选起始音，计算目标音
  5. 用中点法判定谱号（如 clefPref=自动）
  6. 渲染
```

### 音程类型 → 半音数映射
| 类型 | 半音数 | 可能的音程名称 |
|------|--------|---------------|
| 二度 | 1, 2 | 小二度(m2), 大二度(M2) |
| 三度 | 3, 4 | 小三度(m3), 大三度(M3) |
| 四度 | 5 | 纯四度(P4) |
| 五度 | 7 | 纯五度(P5) |
| 六度 | 8, 9 | 小六度(m6), 大六度(M6) |
| 七度 | 10, 11 | 小七度(m7), 大七度(M7) |
| 八度 | 12 | 纯八度(P8) |
| 随机 | 1-12 | 全部 |

注：三全音(TT, 6半音)暂不纳入任何单独类别，仅在"随机"中出现。

### 选项生成
- 根据当前 type 动态构建选项池
- 如 type=三度 → 选项：大三度(M3), 小三度(m3), + 2个同级干扰项
- 如 type=随机 → 选项池包含所有 12 种音程名称

### 和声音程 VexFlow 渲染
- 使用 `StaveNote({ keys: [key1, key2], duration: 'w' })` 叠置
- 处理升降号：两个音都有 accidental 时，下方 accidental 向左偏移避免碰撞
- 小二度叠置时需偏移（seconds look awkward stacked → offset one note left/right）

### 组件架构
- 新建 `IntervalPractice.tsx`，不修改 `PracticeQuiz.tsx`
- 两者共享 UI 骨架（卡片、反馈、进度），但各自实现
- 入口在 `StageSelector.tsx` theory 模块的"练习模式" toggle（复用 Notes 的 toggle 模式）

## Risks / Trade-offs
- 和声音程的 VexFlow accidental 碰撞 → 手动偏移
- 小二度叠置视觉不自然 → 可用小幅水平偏移；上音稍偏右
- 不加音域参数可能导致极端加线 → 起始音反推算法保证合理范围

## Open Questions
- 听音训练的 Web Audio API 实现细节（MVP 可选，标记为 Phase 2）
