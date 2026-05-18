## 1. 共享组件
- [x] 1.1 新建 `src/pages/client/FullPianoKeyboard.tsx`，渲染 A0–C8 的 88 键 SVG（白键 + 黑键），每个 C 键下方写八度标签，中央 C 加突出样式
- [x] 1.2 用 `overflow-x: auto` 的包裹容器实现可视窗口；首次挂载时把 `scrollLeft` 设到中央 C 居中
- [x] 1.3 实现鼠标 / pointer 拖拽平移：pointerdown 起记录起点 → pointermove 计算位移更新 `scrollLeft` → 拖动距离 > 阈值则视为 pan，单击 MUST NOT 触发作答；拖动距离 ≤ 阈值则放行单击作答
- [x] 1.4 保留原有 `onAnswer / feedback` 接口；用本地 `lastClickedId` state 替代外部 `lastAnswer` 高亮（feedback 回到 none 时 flashFill=null 自动隐藏）

## 2. 接入与清理
- [x] 2.1 将 `PracticeQuiz.tsx` 中的内联 `PianoKeyboard` 替换为 `FullPianoKeyboard`，删除旧组件代码
- [x] 2.2 将 `InteractiveQuiz.tsx` 中的内联 `PianoKeyboard` 替换为 `FullPianoKeyboard`，删除旧组件代码

## 3. 验证
- [x] 3.1 `npm run build` 通过（tsc + vite build 都通过）
- [x] 3.2 `npx eslint <new files>` 通过（其它文件上的 lint 错误均为 `main` 上已有问题，未由本次改动引入）
- [x] 3.3 现有单测（`noteAnswer.test.ts`、`keyboardInput.test.ts`）全部 79 个用例通过
- [ ] 3.4 dev server 手动冒烟：piano 模式下能横向滚动 / 拖动 / 触屏滑动；点击任意 C/C#/Db 等正确作答；切回 options 模式不受影响 *(待用户在浏览器中验证；dev server 已启动 http://localhost:5173/)*

## 4. 收尾
- [x] 4.1 `openspec validate add-full-piano-keyboard --strict` 通过
