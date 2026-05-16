# Change: Add physical keyboard input for Notes (A-type) practice in options mode

## Why
桌面端学生做单音(Notes / A 类)练习时，目前只能用鼠标在 7 个音名按钮(C–B)里逐个点选。每答一题都要离开键盘、瞄准、点击，操作摩擦大，与音乐人本来就把音名当字母记忆的直觉不匹配。开放物理键盘作答可以显著加快练习节奏。

## What Changes
- 在 Notes(A 类)题目处于"选项"模式时(`type === 'A' && !usePiano`)，在 `window` 上挂 `keydown` 监听器
- 把物理键 `c, d, e, f, g, a, b`(大小写均接)映射到对应音名选项，复用现有 `handleAnswer` 派发，保证与点击完全一致的反馈/锁定行为
- 监听器仅在 A 类 + 选项模式下绑定;piano 模式、B/C/D 类题、按下 Ctrl/Cmd/Alt 组合键时一律不触发
- 选项按钮上方加一行小字提示("提示: 按键盘 C D E F G A B 也可作答")，但仅在设备报告 `(hover: hover) and (pointer: fine)` 时显示，避免在手机/触屏平板上误导
- Notes 模块的默认输入模式从 `piano`(屏幕钢琴)改为 `options`(选项)，让新用户开箱就看到键盘提示;localStorage 已存值的老用户不受影响

## Impact
- Affected specs: `notes-practice`(全新 capability — 之前 Notes 练习没建过 spec)
- Affected code:
  - `src/pages/client/InteractiveQuiz.tsx`(新增 `useEffect` 监听器 + 提示 UI + ref 形式访问 handleAnswer)
  - `src/pages/client/keyboardInput.ts`(新增纯函数 `mapKeyToNote`，便于单测)
  - `src/pages/client/StageSelector.tsx`(默认值翻转)
- Affected tooling: 引入项目首个测试框架 Vitest，新增 `test` / `test:watch` 脚本
- 不涉及服务端、存储、API。Cloudflare KV 中的老师题库完全不动
