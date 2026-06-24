# 技术设计

## Overview

为单音识别模块添加 MIDI 输入模式。核心思路：将现有布尔型输入模式（`usePiano: boolean`）重构为三值枚举 `InputMode`，新增 `useMidi` Hook 封装 Web MIDI API 生命周期，并通过 `midiNoteToPitch` 工具函数将 MIDI 音符编号转换为应用内部的 Pitch String，最终复用已有的 `handleAnswer` 答题路径。

## Architecture

### 1. 输入模式状态模型重构

将 `useNotesInputMode` 从返回 `[boolean, Dispatch<SetStateAction<boolean>>]` 重构为返回 `[InputMode, (mode: InputMode) => void]`。

```typescript
// src/hooks/useNotesInputMode.ts
export type InputMode = 'options' | 'piano' | 'midi';

export function useNotesInputMode(): [InputMode, (mode: InputMode) => void] {
  const [mode, setMode] = useState<InputMode>(() => {
    const stored = localStorage.getItem(NOTES_INPUT_MODE_KEY);
    if (stored === 'piano' || stored === 'midi') return stored;
    return 'options';
  });

  const updateMode = (next: InputMode) => {
    setMode(next);
    localStorage.setItem(NOTES_INPUT_MODE_KEY, next);
  };

  return [mode, updateMode];
}
```

- localStorage 向后兼容：已存储 `'piano'` 的值直接映射为 `InputMode 'piano'`
- 无值或无法识别的值默认为 `'options'`

### 数据流

```
User presses MIDI key
  → Web MIDI API fires midimessage event
  → useMidi hook parses NoteOn (status 0x90, velocity > 0)
  → midiNoteToPitch converts note number to pitch string
  → onNoteOn callback fires with pitch string
  → handleAnswer processes answer (same as piano mode path)
  → pitchEqual compares answer vs currentPitch
  → feedback / scoring / next question
```

## Components and Interfaces

### NotesInputModeToggle 组件改造

Props 接口变更：

```typescript
type Props = {
  mode: InputMode;
  onChange: (mode: InputMode) => void;
  accentColor?: string;
};
```

- 渲染三个按钮：`'选项'`、`'键盘'`、`'MIDI'`
- MIDI 按钮在 `!navigator.requestMIDIAccess` 时 disabled，附带 tooltip 提示浏览器不支持
- 保持原有药丸（pill）样式，按钮宽度自适应

### useMidi Hook 设计

新建文件 `src/hooks/useMidi.ts`，封装 Web MIDI API 完整生命周期。

```typescript
// src/hooks/useMidi.ts
type MidiStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'permission-denied'
  | 'no-device'
  | 'disconnected'
  | 'unsupported';

interface UseMidiOptions {
  enabled: boolean;                    // mode === 'midi' 时为 true
  onNoteOn: (pitch: string) => void;   // 答题回调
}

interface UseMidiReturn {
  status: MidiStatus;
  deviceName: string | null;
  error: string | null;
}

export function useMidi(options: UseMidiOptions): UseMidiReturn;
```

内部行为：
1. `enabled` 为 true 时调用 `navigator.requestMIDIAccess()`
2. 枚举 `MIDIAccess.inputs`，选取第一个 `state === 'connected'` 的输入端口
3. 监听端口 `midimessage` 事件；解析 status byte `0x90` + velocity > 0 为 NoteOn
4. 监听 `MIDIAccess.onstatechange` 以响应热插拔
5. `enabled` 变为 false 时关闭监听并释放引用（cleanup）
6. 权限被拒时设置 `'permission-denied'`，无设备时设置 `'no-device'`

### MIDI Note Number → Pitch String 转换

在已有的 `src/core/engine/pitchUtils.ts` 中新增工具函数，紧邻现有 `pitchToMidi` 实现：

```typescript
// src/core/engine/pitchUtils.ts
const SHARP_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

/** 将 MIDI 音符编号（0-127）转换为应用 Pitch String。升号优先。 */
export function midiNoteToPitch(midiNumber: number): string {
  const octave = Math.floor(midiNumber / 12) - 1;
  const noteIndex = midiNumber % 12;
  return `${SHARP_NAMES[noteIndex]}${octave}`;
}
// 60 → 'C4', 61 → 'C#4', 69 → 'A4'
```

- 黑键统一使用升号（与现有 piano 模式一致）
- 返回值格式与 `FullPianoKeyboard` 的 `onAnswer` 输出一致，可直接进入 `handleAnswer`

### 答题页面集成

#### PracticeQuiz.tsx

```typescript
// 三分支渲染逻辑
{mode === 'piano' && <FullPianoKeyboard ... />}
{mode === 'options' && <OptionsGrid ... />}
{mode === 'midi' && <MidiStatus status={midi.status} deviceName={midi.deviceName} error={midi.error} />}
```

- `useMidi` 的 `onNoteOn` 回调直接调用 `handleAnswer(pitch)`
- 答题评分逻辑与 piano 模式完全共享（`pitchEqual` 对比完整 pitch string）

#### InteractiveQuiz.tsx

同 PracticeQuiz.tsx 的集成模式。仅在 `module === 'notes'` 的题型分支中生效。

#### StageSelector.tsx

将 `NotesInputModeToggle` 的 prop 从 `usePiano / onChange(boolean)` 改为 `mode / onChange(InputMode)`。

### MidiStatus 组件

新建 `src/components/MidiStatus.tsx`，小型非阻塞式连接状态指示器。

```typescript
// src/components/MidiStatus.tsx
type Props = {
  status: MidiStatus;
  deviceName: string | null;
  error: string | null;
};
```

根据 `status` 渲染不同状态：

| status | 显示内容 |
|--------|----------|
| `connecting` | 连接中… 加载动画 |
| `connected` | ✓ 已连接：{deviceName}，等待弹奏 |
| `no-device` | 未检测到 MIDI 设备，请连接后重试 |
| `permission-denied` | 浏览器已拒绝 MIDI 权限 |
| `disconnected` | 设备已断开，请重新连接 |
| `unsupported` | 当前浏览器不支持 Web MIDI API |

组件不遮挡五线谱区域，放置在答题区（原钢琴/选项位置）。

## Data Models

### InputMode 类型

```typescript
export type InputMode = 'options' | 'piano' | 'midi';
```

三值枚举，代表用户当前的输入方式。通过 localStorage 持久化存储。

### MidiStatus 类型

```typescript
type MidiStatus =
  | 'idle'          // Hook 未激活
  | 'connecting'    // 正在请求 MIDI 权限
  | 'connected'     // 已连接设备，监听中
  | 'permission-denied'  // 用户拒绝权限
  | 'no-device'     // 权限已获取但无设备
  | 'disconnected'  // 设备运行中断开
  | 'unsupported';  // 浏览器不支持 Web MIDI API
```

### UseMidiOptions 接口

```typescript
interface UseMidiOptions {
  enabled: boolean;                    // mode === 'midi' 时为 true
  onNoteOn: (pitch: string) => void;   // NoteOn 事件回调，pitch 为转换后的音高字符串
}
```

### UseMidiReturn 接口

```typescript
interface UseMidiReturn {
  status: MidiStatus;          // 当前连接状态
  deviceName: string | null;   // 已连接设备名称
  error: string | null;        // 错误信息（用于 UI 显示）
}
```

## Error Handling

### 权限被拒（permission-denied）

当用户拒绝浏览器的 MIDI 权限请求时，`useMidi` 捕获 `requestMIDIAccess()` 抛出的 `DOMException`，将状态设为 `'permission-denied'`。UI 显示提示信息，不阻塞其他功能。用户可切换回 options 或 piano 模式继续使用。

### 无设备（no-device）

权限已获取但 `MIDIAccess.inputs` 为空（size === 0）时，状态设为 `'no-device'`。通过 `onstatechange` 监听热插拔，设备接入后自动切换为 `'connected'`。

### 设备断开（disconnected）

已连接设备在使用过程中断开时，通过 `MIDIAccess.onstatechange` 事件检测，状态设为 `'disconnected'`。重新连接后自动恢复。

### 浏览器不支持（unsupported）

`navigator.requestMIDIAccess` 不存在时（如 Firefox），状态设为 `'unsupported'`，MIDI 按钮在 Toggle 组件中自动 disabled。

### cleanup 机制

`enabled` 从 true 变为 false 时，Hook 的 cleanup 函数移除所有 `midimessage` 监听器并释放 `MIDIAccess` 引用，避免内存泄漏。

## Testing Strategy

### 单元测试

- `midiNoteToPitch`：验证 MIDI 编号 0-127 的转换正确性（重点：60→C4, 69→A4, 边界值 0→C-1, 127→G9）
- `useNotesInputMode`：验证 localStorage 读写、默认值、无效值降级
- `InputMode` 类型约束：确保只接受 `'options' | 'piano' | 'midi'`

### Hook 测试（useMidi）

- Mock `navigator.requestMIDIAccess` 测试各状态转换
- 模拟 NoteOn 消息（`[0x90, noteNumber, velocity]`）验证回调触发
- 模拟 velocity === 0 的 NoteOn 不触发答题
- 模拟设备断开/重连的 `onstatechange` 事件

### 集成测试

- 切换 InputMode 后正确渲染对应输入区域
- MIDI 输入经 `midiNoteToPitch` 转换后进入 `handleAnswer` 路径
- 不支持 Web MIDI 的环境中 MIDI 按钮正确 disabled

## Correctness Properties

以下属性在任何情况下必须成立：

### Property 1: midiNoteToPitch 转换一致性

`midiNoteToPitch(60) === 'C4'`，且对于任意有效 MIDI 编号 n (0≤n≤127)，输出格式为 `{NoteName}{Octave}`。

**Validates: Requirements 4.2**

### Property 2: NoteOn velocity 守卫

status byte 为 `0x90` 且 velocity === 0 时，绝不触发 `onNoteOn` 回调（MIDI 规范中 velocity 0 的 NoteOn 等同于 NoteOff）。

**Validates: Requirements 4.4**

### Property 3: pitch 格式兼容性

`midiNoteToPitch` 的输出与 `FullPianoKeyboard.onAnswer` 的输出格式完全一致，可直接传入 `pitchEqual` 进行比较。

**Validates: Requirements 4.1, 5.3**

### Property 4: 模式互斥

任意时刻 `InputMode` 只能为三值之一，且只有当前激活模式的输入区域被渲染。

**Validates: Requirements 1.1, 5.1**

### Property 5: cleanup 完整性

`enabled` 变为 false 后，不会再有 `midimessage` 事件触发 `onNoteOn`。

**Validates: Requirements 6.3**

### Property 6: 向后兼容

localStorage 中已存储的 `'piano'` 值读取后映射为 `InputMode 'piano'`，不丢失用户偏好。

**Validates: Requirements 1.4**

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/hooks/useNotesInputMode.ts` | 修改 | `boolean` → `InputMode` 类型；导出 `InputMode` 类型 |
| `src/components/NotesInputModeToggle.tsx` | 修改 | 三按钮渲染 + MIDI disabled 状态 |
| `src/hooks/useMidi.ts` | 新建 | Web MIDI API 连接管理 Hook |
| `src/core/engine/pitchUtils.ts` | 修改 | 新增 `midiNoteToPitch` 工具函数 |
| `src/components/MidiStatus.tsx` | 新建 | MIDI 连接状态指示器组件 |
| `src/pages/client/PracticeQuiz.tsx` | 修改 | 集成 MIDI 模式三分支 |
| `src/pages/client/InteractiveQuiz.tsx` | 修改 | 集成 MIDI 模式三分支 |
| `src/pages/client/StageSelector.tsx` | 修改 | 适配新 `InputMode` prop 类型 |

## 向后兼容性

- **localStorage 兼容**：已存储 `'piano'` 的用户读取时直接映射为 `InputMode 'piano'`，无需迁移
- **浏览器兼容**：不支持 Web MIDI API（如 Firefox）的浏览器中，MIDI 按钮自动 disabled，不影响现有功能
- **答题逻辑零改动**：MIDI 输入经 `midiNoteToPitch` 转换后产出的 pitch string 格式与 `FullPianoKeyboard` 完全一致，复用相同的 `handleAnswer` → `pitchEqual` 路径
- **渐进增强**：MIDI 功能作为纯增量，不修改选项模式和钢琴模式的任何行为
