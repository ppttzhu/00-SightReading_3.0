# 需求文档

## 简介

为视奏练习应用的单音识别模块添加第三种输入方式——MIDI 输入。当前应用支持"选项"（多选按钮）和"键盘"（屏幕钢琴）两种模式，本功能通过 Web MIDI API 接入物理 MIDI 设备，让用户可以用实体 MIDI 键盘回答音符识别题目。

## 术语表

- **InputMode**: 用户答题输入方式的枚举类型，取值为 `'options' | 'piano' | 'midi'`
- **NotesInputModeToggle**: 输入方式切换组件，显示可选按钮供用户切换 InputMode
- **Web_MIDI_API**: 浏览器原生 MIDI 接口（`navigator.requestMIDIAccess`），用于访问已连接的 MIDI 设备
- **MIDIInput**: Web MIDI API 中表示一个 MIDI 输入端口的对象
- **NoteOn_Event**: MIDI 协议中表示按键按下的消息（status byte 0x90，velocity > 0）
- **MIDI_Note_Number**: MIDI 协议的音高编号（0-127），其中 60 = C4
- **Pitch_String**: 应用内部使用的音高字符串格式，如 `"C4"`、`"F#3"`、`"Bb5"`
- **useMidi_Hook**: 封装 Web MIDI API 连接、设备监听和 NoteOn 事件处理的 React Hook

## 需求

### 需求 1：输入模式状态模型重构

**用户故事：** 作为开发者，我希望将输入模式从布尔值重构为三值枚举，以便支持新增的 MIDI 输入模式。

#### 验收标准

1. THE InputMode type SHALL define exactly three values: `'options'`, `'piano'`, and `'midi'`
2. WHEN the application reads the stored input mode from localStorage, THE useNotesInputMode Hook SHALL return the current InputMode value and a setter function
3. WHEN a user selects an input mode, THE NotesInputModeToggle SHALL persist the selected InputMode string to localStorage under the key `notes_input_mode`
4. WHEN localStorage contains the legacy boolean-equivalent value `'piano'`, THE useNotesInputMode Hook SHALL interpret it as InputMode `'piano'`
5. WHEN localStorage contains no value or an unrecognized value, THE useNotesInputMode Hook SHALL default to InputMode `'options'`

### 需求 2：输入方式切换 UI 扩展

**用户故事：** 作为用户，我希望在切换按钮中看到第三个"MIDI"选项，以便选择使用物理 MIDI 设备答题。

#### 验收标准

1. THE NotesInputModeToggle SHALL render three buttons labeled `'选项'`、`'键盘'`、`'MIDI'`
2. WHEN a user taps one of the three buttons, THE NotesInputModeToggle SHALL invoke the onChange callback with the corresponding InputMode value
3. WHEN the active InputMode matches a button, THE NotesInputModeToggle SHALL visually highlight that button with the accent color
4. WHEN the browser does not support Web MIDI API, THE NotesInputModeToggle SHALL disable the MIDI button and display a tooltip indicating lack of browser support

### 需求 3：Web MIDI API 连接管理

**用户故事：** 作为用户，我希望应用能自动检测并连接我的 MIDI 设备，以便我无需手动配置即可开始练习。

#### 验收标准

1. WHEN the InputMode is set to `'midi'`, THE useMidi_Hook SHALL request MIDI access from the browser via `navigator.requestMIDIAccess`
2. WHEN MIDI access is granted, THE useMidi_Hook SHALL enumerate available MIDIInput ports and select the first available input
3. WHEN a MIDI device is connected or disconnected while InputMode is `'midi'`, THE useMidi_Hook SHALL update the available device list accordingly
4. IF the user denies MIDI permission, THEN THE useMidi_Hook SHALL set a permission-denied error state and not retry until the user re-selects MIDI mode
5. IF no MIDI input devices are detected after access is granted, THEN THE useMidi_Hook SHALL set a no-device error state

### 需求 4：MIDI NoteOn 事件处理与音高转换

**用户故事：** 作为用户，我希望按下 MIDI 键盘的琴键后系统能识别我弹奏的音符并自动作答，以便获得即时反馈。

#### 验收标准

1. WHEN a NoteOn_Event with velocity greater than zero is received, THE useMidi_Hook SHALL convert the MIDI_Note_Number to a Pitch_String
2. THE MIDI-to-pitch conversion SHALL map MIDI_Note_Number 60 to `'C4'`, 61 to `'C#4'`, 62 to `'D4'`, and so on following the standard chromatic scale
3. WHEN a valid Pitch_String is produced from a NoteOn_Event, THE useMidi_Hook SHALL invoke the answer submission callback with that Pitch_String
4. WHEN a NoteOn_Event with velocity equal to zero is received, THE useMidi_Hook SHALL treat it as a NoteOff and not trigger any answer submission

### 需求 5：MIDI 模式下的答题页面集成

**用户故事：** 作为用户，我希望在 PracticeQuiz 和 InteractiveQuiz 页面选择 MIDI 模式后，能直接通过 MIDI 键盘答题而无需看到屏幕钢琴或选项按钮。

#### 验收标准

1. WHILE InputMode is `'midi'`, THE PracticeQuiz page SHALL hide the on-screen piano keyboard and option buttons
2. WHILE InputMode is `'midi'`, THE PracticeQuiz page SHALL display a MIDI connection status indicator showing connected device name or error state
3. WHEN the useMidi_Hook reports a successful note answer via MIDI input, THE quiz page SHALL process the answer using the same scoring logic as other input modes
4. WHILE InputMode is `'midi'` and no device is connected, THE quiz page SHALL display a prompt instructing the user to connect a MIDI device or switch input mode

### 需求 6：MIDI 模式错误状态与恢复

**用户故事：** 作为用户，我希望在 MIDI 设备断开或权限被拒时能看到清晰的提示并方便地切换到其他输入方式。

#### 验收标准

1. IF a connected MIDI device is disconnected during a quiz session, THEN THE useMidi_Hook SHALL emit a device-disconnected error state within 1 second
2. WHEN a device-disconnected error occurs, THE quiz page SHALL display a non-blocking notification suggesting the user to reconnect or switch input mode
3. WHEN the user switches InputMode away from `'midi'`, THE useMidi_Hook SHALL close any active MIDI port listeners and release resources
4. IF the browser does not support Web MIDI API at all, THEN THE system SHALL prevent selection of MIDI mode and display a browser-incompatibility message
