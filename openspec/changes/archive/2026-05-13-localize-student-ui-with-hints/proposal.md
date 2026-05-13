# Change: Localize Student UI and Add Hint Tooltips

## Why
学生端首页 `MainMenu` 和关卡选择页 `StageSelector` 当前全部使用英文文案（如 "Select Your Trial"、"Notes"、"Back to Menu"），对中文用户（尤其是低龄学生）不够友好。此外，四个练习模块（音符、符号、乐理、节奏型）缺乏直观说明，学生无法在进入前先了解每个模块的练习内容，降低了首次使用的引导性。

## What Changes
- **MainMenu 中文化**：大标题改为中文；四个模块卡片采用「主中文 + 副英文」双语展示（如 "音符 Notes"）
- **添加提示按钮（Tooltip）**：每个模块卡片左上角放置小圆角 ⓘ 图标按钮；hover 时弹出 Tooltip 气泡，展示该模块的 2-3 行简介（目标人群、练习内容、大致耗时）
- **StageSelector 中文化**：页面标题、返回按钮文案改为中文；空状态文案中文化
- **Tooltip 移动端适配**：移动端无 hover，降级为点击触发（tap 展开，点击外部或再次点击关闭）
- **样式保持现有风格**：所有改动使用内联样式，与当前卡片 hover 动效、阴影、圆角保持一致

## Impact
- Affected specs: `client-ui`（新建 capability）
- Affected code:
  - `src/pages/client/MainMenu.tsx`（修改：标题、卡片文案、提示按钮与 Tooltip 逻辑）
  - `src/pages/client/StageSelector.tsx`（修改：标题、按钮、空状态文案）
  - `src/index.css`（可能追加：Tooltip 相关 CSS 类与移动端媒体查询）
