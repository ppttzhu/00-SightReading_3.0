## 1. 键盘音区模型
- [x] 1.1 在 `FullPianoKeyboard.tsx` 附近提取或导出 7 区配置，覆盖 `A0-C8`
- [x] 1.2 添加纯函数测试，验证每个 zone 的起止音、中心音和滚动目标计算

## 2. 缩略图 UI
- [x] 2.1 在 `FullPianoKeyboard` 内渲染缩略键盘条
- [x] 2.2 在缩略键盘上叠加 7 个可点击音区框和当前视窗框
- [x] 2.3 添加组件测试，验证 7 个区块按钮存在且显示对应 range label

## 3. 导航行为
- [x] 3.1 监听大键盘容器 scroll，更新当前视窗框
- [x] 3.2 点击任一区块时平滑滚动到该区中心
- [x] 3.3 确保区块点击不调用 `onAnswer`，不播放音频，也不受答题反馈锁定影响

## 4. 视觉 polish
- [x] 4.1 滑动/拖拽时提升缩略图不透明度，空闲时回到更安静的状态
- [x] 4.2 在桌面和移动端保持布局不遮挡乐谱、选项或大键盘

## 5. 验证
- [x] 5.1 `npm test -- FullPianoKeyboard`
- [x] 5.2 `npm test`
- [x] 5.3 `npm run build`
- [x] 5.4 `openspec validate add-piano-zone-thumbnail --strict`
