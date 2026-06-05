## ADDED Requirements

### Requirement: 钢琴缩略图音区导航
Notes(A 类) piano 模式 SHALL 在 88 键滑动键盘上方显示一个缩略键盘导航条。缩略图 SHALL 展示标准钢琴范围 `A0-C8`；系统 SHALL 在用户滑动或滚动大键盘时标示当前大键盘可见范围，帮助用户判断自己所在音区。

#### Scenario: 缩略图显示当前视窗
- **WHEN** 用户进入 Notes piano 模式并看到 88 键滑动键盘
- **THEN** 系统 SHALL 在大键盘上方渲染缩略键盘
- **AND** 缩略键盘默认不显示当前视窗框，避免与音区交互框同时常驻造成视觉拥挤

#### Scenario: 滑动时视窗同步
- **WHEN** 用户通过触屏滑动、桌面拖拽或原生横向滚动条移动大键盘
- **THEN** 缩略键盘上的视窗框 SHALL 显示并跟随 `scrollLeft` 更新
- **AND** 滑动空闲后，视窗框 SHALL 隐藏

### Requirement: 钢琴缩略图七区入口
缩略键盘 SHALL 默认划分为 7 个连续可点击音区：`A0-B1`、`C2-B2`、`C3-B3`、`C4-B4`、`C5-B5`、`C6-B6`、`C7-C8`。每个音区 SHALL 直接使用对应 range 作为 label；音区边框默认不常驻显示，只有 hover/focus 或用户点击选中该音区时显示。

#### Scenario: 七区完整覆盖
- **WHEN** 缩略键盘渲染完成
- **THEN** 系统 SHALL 显示 7 个音区入口
- **AND** 第一区 SHALL 覆盖 `A0-B1`
- **AND** 第二区 SHALL 覆盖 `C2-B2`
- **AND** 第三区 SHALL 覆盖 `C3-B3`
- **AND** 第四区 SHALL 覆盖 `C4-B4`
- **AND** 第五区 SHALL 覆盖 `C5-B5`
- **AND** 第六区 SHALL 覆盖 `C6-B6`
- **AND** 第七区 SHALL 覆盖 `C7-C8`

#### Scenario: 点击音区跳转
- **WHEN** 用户点击缩略键盘上的任一音区
- **THEN** 大键盘 SHALL 平滑滚动，使该音区中心尽量进入可见区域中心
- **AND** 被点击的音区 SHALL 短暂显示选区框
- **AND** 本次点击 MUST NOT 提交答案
- **AND** 本次点击 MUST NOT 播放音频

#### Scenario: 保留大键盘直接操作
- **WHEN** 用户不点击缩略图，而是在大键盘上继续滑动、拖拽或点击琴键
- **THEN** 系统 SHALL 保留现有滑动、拖拽、点击作答和反馈锁定行为

### Requirement: 本变更不新增固定键盘切换
本变更 SHALL NOT 新增“滑动键盘 / 固定键盘+音区”的切换开关。音区导航 SHALL 与现有滑动键盘共存，而不是替换现有输入方式。

#### Scenario: Piano 模式仍使用同一个滑动键盘
- **WHEN** 用户处于 Notes piano 模式
- **THEN** 系统 SHALL 显示现有 88 键滑动键盘和新增缩略导航
- **AND** 系统 MUST NOT 显示新的固定键盘切换开关
