## 1. Test infrastructure
- [x] 1.1 安装 Vitest 作为 devDependency
- [x] 1.2 在 `package.json` 增加 `test` 和 `test:watch` 脚本

## 2. Keyboard input mapper
- [x] 2.1 新建 `src/pages/client/keyboardInput.ts`，导出 `mapKeyToNote(key: string): string | null`
- [x] 2.2 新建 `src/pages/client/keyboardInput.test.ts`，覆盖 C–B(大小写)、其他字母、Enter、空格、空字符串、数字标点

## 3. Wire into InteractiveQuiz
- [x] 3.1 在 `InteractiveQuiz.tsx` 增加 `useEffect`，在 A 类 + `!usePiano` 时绑定 `window` `keydown` 监听器
- [x] 3.2 监听器内调用 `mapKeyToNote`，非空结果转发给现有 `handleAnswer`(通过 ref 引用最新闭包)
- [x] 3.3 在选项区上方加一行键盘提示，仅在 `(hover: hover) and (pointer: fine)` 设备上显示
- [x] 3.4 把 Notes 输入模式默认值从 `piano` 改为 `options`(`StageSelector.tsx` 和 `InteractiveQuiz.tsx` 各一处)

## 4. Verification
- [x] 4.1 `npm run test` 全绿
- [x] 4.2 `npm run lint` 无新增错误(与 main 基线对齐)
- [x] 4.3 `npm run build` 成功
- [x] 4.4 手测: C–B 正确作答;非映射键无反应;反馈锁定期忽略按键;piano 模式不绑定;B/C/D 类不绑定;手机模拟器下提示隐藏

## 5. Ship
- [x] 5.1 在 `feat/notes-keyboard-input` 分支提交
- [x] 5.2 推到远程，拿 Cloudflare Pages preview URL 给 owner review
