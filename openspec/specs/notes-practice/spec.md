# notes-practice Specification

## Purpose
TBD - created by archiving change add-notes-keyboard-input. Update Purpose after archive.
## Requirements
### Requirement: Physical Keyboard Input In Options Mode
当 Notes(A 类)题目处于"选项"模式时，系统 SHALL 接受物理键盘 `C`、`D`、`E`、`F`、`G`、`A`、`B`(大小写均可)作为等价于点击对应音名按钮的输入，并且 MUST 走与点击相同的判题路径(即复用现有的反馈与锁定逻辑)。

#### Scenario: 按下映射键提交答案
- **WHEN** 当前是 A 类题目处于"选项"模式，用户按下 `c`(或 `C`)
- **THEN** 系统以 `C` 作为答案提交，触发标准的正确/错误反馈流程

#### Scenario: 未映射的按键被忽略
- **WHEN** 用户按下 C/D/E/F/G/A/B 以外的任意键(如 `x`、`Enter`、空格、数字、修饰键)
- **THEN** 系统 MUST NOT 提交任何答案，也 MUST NOT 改变题目状态

#### Scenario: 反馈锁定期忽略键盘
- **WHEN** 当前题目正处于答题后的反馈展示期
- **THEN** 物理键盘按键 MUST 被忽略，直到反馈结束(与点击路径已有的锁定一致)

#### Scenario: 修饰键组合不触发作答
- **WHEN** 用户在按住 Ctrl、Cmd 或 Alt 的同时按下 C/D/E/F/G/A/B
- **THEN** 系统 MUST NOT 提交答案，避免与浏览器或系统快捷键冲突

### Requirement: Keyboard Listener Scope
键盘监听器 SHALL 仅在 A 类题目 + "选项"模式下生效;在 piano 模式或 B/C/D 类题目时 MUST 被禁用。

#### Scenario: piano 模式禁用物理键监听
- **WHEN** 用户在 Notes 模块切换到 piano(屏幕钢琴)输入模式
- **THEN** 按下物理键 C/D/E/F/G/A/B MUST NOT 提交答案;只有屏幕钢琴可作答

#### Scenario: 非 A 类题型忽略监听
- **WHEN** 当前题目是 B(符号)、C(乐理)或 D(音型)
- **THEN** 物理键字母按键 MUST NOT 提交答案

### Requirement: Discoverable Hint
系统 SHALL 在 Notes "选项"模式下，在选项按钮上方展示一行键盘提示，让"可用键盘作答"这件事不需要看文档就能发现;但仅当设备报告 `(hover: hover) and (pointer: fine)`(即桌面/笔记本/带物理键盘的平板)时显示，避免在手机和纯触屏平板上展示误导性的提示。

#### Scenario: 在有键盘的设备上显示提示
- **WHEN** 用户在 A 类题目"选项"模式下，且设备匹配 `(hover: hover) and (pointer: fine)`
- **THEN** 选项按钮上方渲染一行类似"提示: 按键盘 C D E F G A B 也可作答"的文字

#### Scenario: 在纯触屏设备上隐藏提示
- **WHEN** 用户在 A 类题目"选项"模式下，但设备报告 coarse pointer 或不支持 hover(典型如手机、触屏平板)
- **THEN** 键盘提示 MUST NOT 出现

#### Scenario: 在作用域外隐藏提示
- **WHEN** 用户处于 piano 模式，或当前是非 A 类题目
- **THEN** 键盘提示 MUST NOT 出现

### Requirement: Default Input Mode For Notes
Notes 模块对新用户(localStorage 中没有 `notes_input_mode` 记录的用户)的默认输入模式 SHALL 为 `options`，以便新用户进入后立即看到键盘作答提示;对已经在 localStorage 中保存过偏好的老用户，系统 MUST 保留其原选择不变。

#### Scenario: 新用户首次进入 Notes 模块
- **WHEN** 用户首次进入 Notes 关卡选择页且 localStorage 不含 `notes_input_mode`
- **THEN** 输入模式默认值为 `options`，"选项"按钮处于选中态

#### Scenario: 老用户保留先前选择
- **WHEN** 用户之前手动切换过输入模式，localStorage 已存有 `notes_input_mode = 'piano'` 或 `'options'`
- **THEN** 系统 MUST 沿用已存储的值，MUST NOT 因为默认值变化而覆盖

### Requirement: Full Piano Keyboard Range
Notes(A 类) piano 模式 SHALL 渲染覆盖标准 88 键(A0–C8)的钢琴键盘，而不是单个八度。键盘以 SVG 形式一次性绘制完整范围，可见区域由外层带 `overflow-x: auto` 的容器决定；首次进入时视窗 MUST 滚动到中央 C(C4)居中位置，给学生一个固定的起始锚点。

#### Scenario: 首次进入 piano 模式定位到中央 C
- **WHEN** 用户在 Notes A 类题目下选择 piano 模式并进入题目
- **THEN** 键盘组件挂载后，横向滚动容器 MUST 将 C4 居中显示在可视区域

#### Scenario: 八度标签与中央 C 标记
- **WHEN** 键盘渲染完成
- **THEN** 每个 C 键(C2、C3、C4、C5、C6、C7…)下方 SHALL 显示其八度名称；C4 MUST 使用比其他 C 更突出的视觉样式(如更深字色或小色块)以便快速定位

#### Scenario: 作答语义按八度精确匹配
- **WHEN** 题目音高为 C4，用户在键盘上点击某个 C 键
- **THEN** 仅当被点击的键是 C4 时系统 MUST 判为正确；点击 C2/C3/C5/C6/… 任意其他八度的 C MUST 判为错误

#### Scenario: 同八度内 sharp/flat 等音对等价
- **WHEN** 题目音高为 F#4，用户在键盘上点击 F#4 键（系统内部即 F#/Gb 那一个黑键，等音对：C#↔Db、D#↔Eb、F#↔Gb、G#↔Ab、A#↔Bb）
- **THEN** 系统 MUST 判为正确，无论题目原始拼写是 F#4 还是 Gb4；但跨八度（如 Gb5）MUST 判为错误

### Requirement: Swipe And Drag To Pan Keyboard
全键盘 MUST 支持横向平移以让用户查看不同音域：移动端使用原生横向滑动手势(touch swipe)；桌面端使用鼠标 / pointer 拖拽，按下并水平拖动即可改变 `scrollLeft`。拖拽与点击 MUST 互斥——拖拽位移超过点击阈值后，本次 pointerup MUST NOT 被判定为答题；位移在阈值以内时则 MUST 作为正常单击作答。

#### Scenario: 触屏左右滑动改变视窗
- **WHEN** 用户在触屏设备的钢琴键盘区域水平滑动
- **THEN** 键盘视窗 MUST 跟随手指平移，展现不同八度，并且 MUST NOT 因为手指落点在某个琴键上就触发作答

#### Scenario: 桌面端鼠标拖动平移
- **WHEN** 用户在桌面浏览器内按住鼠标左键并在键盘上水平拖动超过阈值(例如 6 px)
- **THEN** 视窗 MUST 跟随光标平移；本次 pointerup MUST NOT 触发作答

#### Scenario: 短按视为作答
- **WHEN** 用户在键盘上按下并松开鼠标，且 pointerdown→pointerup 的水平位移在阈值以内
- **THEN** 系统 MUST 以被按下的琴键音高(含八度，例如 `C#4`)为答案提交，走与原单八度键盘等价的判题路径

#### Scenario: 反馈期点击被忽略
- **WHEN** 当前题目正处于答题后的反馈展示期
- **THEN** 键盘上的点击 MUST 被忽略(与现有 `feedback !== 'none'` 锁定行为一致)

### Requirement: 钢琴缩略图音区导航
Notes(A 类) piano 模式 SHALL 在 88 键滑动键盘上方显示一个缩略键盘导航条。缩略图 SHALL 展示标准钢琴范围 `A0-C8`；系统 SHALL 以低调高亮标示当前大键盘可见范围，帮助用户判断自己所在音区。

#### Scenario: 缩略图显示当前视窗
- **WHEN** 用户进入 Notes piano 模式并看到 88 键滑动键盘
- **THEN** 系统 SHALL 在大键盘上方渲染缩略键盘
- **AND** 缩略键盘 SHALL 默认以浅蓝半透明 tint 标示当前主键盘可见范围
- **AND** 每个音区 SHALL 默认显示轻量中性边界，使分区范围可辨识但不抢过当前视窗高亮

#### Scenario: 滑动时视窗同步
- **WHEN** 用户通过触屏滑动、桌面拖拽或原生横向滚动条移动大键盘
- **THEN** 缩略键盘上的当前视窗高亮 SHALL 跟随 `scrollLeft` 更新并增强显示
- **AND** 若此前有点击音区产生的选区框，系统 SHALL 立即清除该选区框
- **AND** 滑动空闲后，当前视窗高亮 SHALL 回到低调显示状态

### Requirement: 钢琴缩略图七区入口
缩略键盘 SHALL 默认划分为 7 个连续可点击音区：`A0-B1`、`C2-B2`、`C3-B3`、`C4-B4`、`C5-B5`、`C6-B6`、`C7-C8`。每个音区 SHALL 直接使用对应 range 作为 label；音区 SHALL 默认显示轻量中性边界，只有用户点击选中、或在支持 hover 的 fine pointer 设备上 hover/focus 时，才显示更强的蓝色选区边框。hover/focus 引起的蓝色边框 SHALL 仅在 `(hover: hover) and (pointer: fine)` 设备上启用，避免触屏浏览器保留 sticky hover 状态。

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
- **THEN** 大键盘 SHALL 立即跳转，使该音区中心尽量进入可见区域中心
- **AND** 被点击的音区 SHALL 短暂显示选区框
- **AND** 本次程序跳转产生的滚动事件 MUST NOT 立即清除该选区框
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
