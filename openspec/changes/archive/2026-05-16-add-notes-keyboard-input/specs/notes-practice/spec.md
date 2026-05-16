## ADDED Requirements

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
