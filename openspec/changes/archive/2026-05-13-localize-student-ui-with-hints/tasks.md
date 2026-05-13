## 1. MainMenu — Localization + Tooltip
- [x] 1.1 修改 `src/pages/client/MainMenu.tsx`：大标题从 "Select Your Trial" 改为 "选择练习项目"
- [x] 1.2 修改 `modules` 数组：每个模块增加 `label`（中文）与 `hint`（提示文案）字段
  - 音符 Notes："识别五线谱上的音名，建立读谱基础。适合零基础学员。单关约 3-5 分钟。"
  - 符号 Symbols："认识各种音乐符号与记号，提升乐谱阅读能力。适合已掌握音符的学员。"
  - 乐理 Theory："理解音程、调式、和弦等基础乐理知识。适合进阶学员。"
  - 节奏型 Patterns："练习不同节奏型的识别与拍感。适合有一定基础的学员。"
- [x] 1.3 卡片标题改为「主中文 + 副英文」：`<h2>` 主标题放中文，`subtitle` 放英文
- [x] 1.4 卡片左上角添加 ⓘ 提示按钮（小圆角图标，24px，颜色使用模块主色）
- [x] 1.5 实现 Tooltip：hover 时从按钮下方/右侧弹出白色气泡（带阴影），展示 `hint` 内容；气泡宽度约 220px，文字 14px，行高 1.5
- [x] 1.6 Tooltip 位置计算：防止超出视口，靠近右边缘时向左偏移
- [x] 1.7 Tooltip 移动端降级：无 hover 的设备上，点击 ⓘ 展开气泡，点击卡片其他区域或再次点击 ⓘ 关闭

## 2. StageSelector — Localization
- [x] 2.1 修改 `src/pages/client/StageSelector.tsx`：返回按钮 "← Back to Menu" 改为 "← 返回主菜单"
- [x] 2.2 页面标题 `MODULE_LABELS` 改为中英双语映射：
  - notes → "音符 Trials"
  - symbols → "符号 Trials"
  - theory → "乐理 Trials"
  - patterns → "节奏型 Trials"
- [x] 2.3 空状态文案中文化："No stages available yet" → "暂无可用关卡"；"Ask the teacher to add questions for this module." → "请联系老师为该模块添加题目。"

## 3. Styling & Responsive
- [x] 3.1 在 `src/index.css` 追加 `.hint-tooltip` 相关样式：绝对定位、白色背景、圆角 12px、阴影、z-index 高于卡片
- [x] 3.2 移动端媒体查询（`@media (max-width: 640px)`）：
  - 提示按钮缩小至 20px
  - Tooltip 宽度调整为 `calc(100vw - 40px)`，避免超出屏幕
- [x] 3.3 检查现有 hover 动效不被 Tooltip 打断（事件冒泡处理）

## 4. Validation
- [x] 4.1 `npm run build` 通过（TypeScript + Vite）
- [x] 4.2 浏览器端到端：
  - 首页四个模块卡片显示中文标题 + 英文副标题
  - 鼠标 hover ⓘ 按钮显示对应提示气泡
  - 移动端点击 ⓘ 按钮展开/收起提示
  - 进入任一模块，StageSelector 标题和返回按钮已中文化
  - 空模块状态显示中文文案
