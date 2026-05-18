# Change: Notes piano 模式扩展为全键盘 + 横向滑动调节音域

## Why
目前 Notes(A 类)piano 模式只渲染一个八度的钢琴键盘(C–B + 5 个黑键)，与真实钢琴差距过大；学生在桌面端、手机端都无法通过常规的"在大钢琴上找音"思路来作答，定位中央 C 也没有视觉参照。

## What Changes
- piano 模式将 SVG 键盘范围 SHALL 从单个八度扩展为标准 88 键(A0–C8)。
- 在可视区域内一次显示约 2 个八度(具体宽度依容器自适应)，超出部分通过横向滚动展示。
- 支持两种平移交互：
  - 触屏 / 移动端：原生横向滑动手势(swipe / horizontal scroll)。
  - 桌面端：在键盘空白处或按住任意琴键拖动同样可平移(pointer drag → `scrollLeft`)，但**点按琴键单击 MUST 仍然作答**，不能被拖拽监听器吞掉。
- 每个 C 键下方 SHALL 显示八度标签(`C2`、`C3`、`C4`…)；中央 C(C4) MUST 视觉上更醒目，给出"定位锚点"。
- 初始视窗 SHALL 滚到中央 C 居中位置。
- 作答语义不变：点击任一键 → 提交其音名(`C`/`C#`/`Db`…)，不携带八度信息，复用现有 `enharmonicEqual` 判分。
- 重构：将内联在 `PracticeQuiz.tsx` 与 `InteractiveQuiz.tsx` 的 `PianoKeyboard` 抽出为共享组件 `src/pages/client/FullPianoKeyboard.tsx`，两处共用。

## Impact
- Affected specs: `notes-practice`
- Affected code:
  - 新增 `src/pages/client/FullPianoKeyboard.tsx`
  - 修改 `src/pages/client/PracticeQuiz.tsx`、`src/pages/client/InteractiveQuiz.tsx`(移除本地 `PianoKeyboard`，引入新组件)
- 不影响 options 模式、物理键盘监听、判分逻辑或现有的 A/B/C/D 类型走线
