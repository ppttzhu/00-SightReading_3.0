## MODIFIED Requirements

### Requirement: PatternContent Data Model
`PatternContent` SHALL 支持和弦识别子类型，通过可选字段与传统音型题共存。

```typescript
interface PatternContent {
  pattern: string;          // 传统音型名（和弦题时留空）
  raw: string;              // 原始字符串
  notes?: string[];         // 音符列表
  options?: string[];       // 自定义选项

  // 和弦识别专用（可选）
  chordType?: 'chord';      // 存在时标记为和弦题
  chordName?: string;       // 和弦答案，如 'C Major'
  inversion?: string;       // 'root' | '1st' | '2nd' | '3rd' | ''
  displayMode?: 'block' | 'arpeggio';  // 柱式或分解
}
```

#### Scenario: 传统音型题兼容
- **WHEN** `PatternContent` 不包含 `chordType` 字段
- **THEN** 系统以传统音型逻辑处理（pattern 名称为答案，notes 仅用于渲染）

#### Scenario: 和弦题识别
- **WHEN** `PatternContent` 包含 `chordType: 'chord'`
- **THEN** 系统以和弦逻辑处理（chordName 为答案，notes 为和弦内容）

### Requirement: Chord Rendering in InteractiveQuiz
`InteractiveQuiz.tsx` 的 `patterns` 渲染分支 SHALL 根据 `chordType` 和 `displayMode` 选择渲染方式。

#### Scenario: 柱式和弦渲染
- **WHEN** `chordType === 'chord'` 且 `displayMode === 'block'`
- **THEN** 使用 `StaveNote({ keys: [...], duration: 'w' })` 渲染为多音叠加的柱式和弦
- **AND** `keys` 数组长度 MUST ≤ 4（Phase 1-2 限制，5+ 音和弦为 Phase 4）

#### Scenario: 分解和弦渲染
- **WHEN** `chordType === 'chord'` 且 `displayMode === 'arpeggio'`
- **THEN** 使用现有四分音符序列逻辑，音符逐个渲染

#### Scenario: 分解和弦渲染
- **WHEN** `chordType === 'chord'` 且 `displayMode === 'arpeggio'`
- **THEN** 使用现有四分音符序列逻辑，音符逐个渲染

#### Scenario: 传统音型题不变
- **WHEN** `chordType` 不存在或未定义
- **THEN** 走现有传统音型渲染路径（不变）
