## ADDED Requirements

### Requirement: Full Piano Keyboard Range
Notes(A 类) piano 模式 SHALL 渲染覆盖标准 88 键(A0–C8)的钢琴键盘，而不是单个八度。键盘以 SVG 形式一次性绘制完整范围，可见区域由外层带 `overflow-x: auto` 的容器决定；首次进入时视窗 MUST 滚动到中央 C(C4)居中位置，给学生一个固定的起始锚点。

#### Scenario: 首次进入 piano 模式定位到中央 C
- **WHEN** 用户在 Notes A 类题目下选择 piano 模式并进入题目
- **THEN** 键盘组件挂载后，横向滚动容器 MUST 将 C4 居中显示在可视区域

#### Scenario: 八度标签与中央 C 标记
- **WHEN** 键盘渲染完成
- **THEN** 每个 C 键(C2、C3、C4、C5、C6、C7…)下方 SHALL 显示其八度名称；C4 MUST 使用比其他 C 更突出的视觉样式(如更深字色或小色块)以便快速定位

#### Scenario: 作答语义仅取音名
- **WHEN** 用户在键盘任意八度上点击 `C`(或 `C#`、`Db` 等)键
- **THEN** 系统 MUST 以纯音名(`C`/`C#`/`Db`)作为答案提交，不携带八度，并复用现有 `enharmonicEqual` 判分；同名键(如 C3 与 C4)在判分上等价

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
- **THEN** 系统 MUST 以被按下的琴键音名为答案，走与原单八度键盘等价的判题路径

#### Scenario: 反馈期点击被忽略
- **WHEN** 当前题目处于答题后的反馈展示期
- **THEN** 键盘上的点击 MUST 被忽略(与现有 `feedback !== 'none'` 锁定行为一致)
