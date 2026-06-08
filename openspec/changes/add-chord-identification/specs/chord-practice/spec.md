## ADDED Requirements

### Requirement: Chord Analyzer Engine
系统 SHALL 提供和弦分析引擎，接收音高字符串数组，返回和弦分析结果。

```typescript
interface ChordAnalysis {
  root: string;           // 根音音名，如 'C'
  quality: string;        // 和弦性质，如 'Major'
  name: string;           // 完整名称，如 'C Major'
  inversion: string;      // 'root' | '1st' | '2nd' | '3rd'
  confidence: number;     // 0-1
}

function analyzeChord(pitches: string[]): ChordAnalysis | null;
```

#### Scenario: 基础三和弦识别
- **WHEN** 输入 `['C4', 'E4', 'G4']`
- **THEN** 返回 `{ root: 'C', quality: 'Major', name: 'C Major', inversion: 'root', confidence: 1 }`

#### Scenario: 七和弦识别
- **WHEN** 输入 `['G3', 'B3', 'D4', 'F4']`
- **THEN** 返回 `{ root: 'G', quality: 'Dom7', name: 'G7', inversion: 'root', confidence: 1 }`

#### Scenario: 分解和弦输入
- **WHEN** 输入 `['C4', 'E4', 'G4', 'C5', 'E5']`
- **THEN** 音高集合归一化为 `{C, E, G}`，返回 `C Major`

#### Scenario: 无法识别
- **WHEN** 输入 `['C4', 'D4', 'F#4']` 不匹配任何和弦模板
- **THEN** 返回 `null`

#### Scenario: 等音拼写以输入字母名为准
- **WHEN** 输入 `['Db4', 'F4', 'Ab4']`，半音集合匹配 Major 模板且根音半音 = 1
- **THEN** 系统检测输入中有字母名 `Db`，返回 `{ root: 'Db', quality: 'Major', name: 'Db Major', ... }`
- **AND** MUST NOT 返回 `C# Major`（只有输入 `C#4, F4, G#4` 时才会返回 `C# Major`）

### Requirement: Chord Analysis Templates
和弦分析引擎 SHALL 使用预定义模板库进行匹配，至少覆盖 10 种常见和弦。

#### Scenario: 三和弦模板
- **WHEN** 音高集合匹配大三度+纯五度
- **THEN** 识别为 `Major`
- **WHEN** 音高集合匹配小三度+纯五度
- **THEN** 识别为 `Minor`
- **WHEN** 音高集合匹配小三度+减五度
- **THEN** 识别为 `Diminished`

#### Scenario: 七和弦模板
- **WHEN** 音高集合匹配大三度+纯五度+小七度
- **THEN** 识别为 `Dom7`
- **WHEN** 音高集合匹配大三度+纯五度+大七度
- **THEN** 识别为 `Maj7`
- **WHEN** 音高集合匹配小三度+纯五度+小七度
- **THEN** 识别为 `Min7`

### Requirement: Chord Ambiguity Resolution
当同一组音高匹配多个和弦模板时，系统 SHALL 按优先级选择最佳匹配，并将歧义情况告知教师。

#### Scenario: 歧义提示
- **WHEN** 输入 `['C4', 'E4', 'G4', 'A4']` 同时匹配 C6 和 Am7
- **THEN** 系统 SHALL 显示所有匹配结果，推荐最低音为根音的方案，并允许教师手动选择或自定义

### Requirement: Quick Chord Creation Mode
ManualCreator 在 patterns 类型下 SHALL 提供"和弦识别"子模式，支持快速选择和自定义音高两种输入方式。

#### Scenario: 快速选择出题
- **WHEN** 教师选择"和弦识别"子类型
- **THEN** 显示根音选择器（C-B + 升降号）和性质选择器（大三/小三/减三/增三/属七/大七/小七）
- **AND** 显示"添加到素材池"按钮
- **AND** 点击后系统自动生成音高、设置难度、生成干扰项

#### Scenario: 实时预览
- **WHEN** 教师在快速选择模式下改变根音或性质
- **THEN** VexFlow 预览区实时更新，显示对应的柱式和弦

#### Scenario: 自定义音高输入
- **WHEN** 教师输入音高字符串如 `C4, E4, G4`
- **THEN** 系统实时调用 `analyzeChord`，显示识别结果和弦名
- **AND** 提供"确认"和"修改"选项

### Requirement: Chord Answer Options Generation
系统 SHALL 根据和弦题的正确答案和难度自动生成 4 个选项（1 正确 + 3 干扰项）。

#### Scenario: 自动生成干扰项
- **WHEN** 创建 C Major 和弦题（难度 1）
- **THEN** 干扰项从相同难度的和弦池中选取，如 F Major、A Minor、G Major

#### Scenario: 同音数优先
- **WHEN** 生成 7 和弦题（4 音）的干扰项
- **THEN** 优先选择同为 4 音的和弦作为干扰项

### Requirement: Chord Free Practice Mode
系统 SHALL 在 FreePracticeHub 中提供和弦识别练习入口，支持参数筛选。

#### Scenario: 练习入口
- **WHEN** 用户在 FreePracticeHub 中点击"和弦识别"卡片
- **THEN** 显示和弦筛选器（和弦类型/转位/显示模式/难度范围）
- **AND** 显示"开始练习"按钮

#### Scenario: 从题库出题
- **WHEN** 用户设置筛选条件并开始练习
- **THEN** 系统从 `slicesPool` 中筛选出符合条件的和弦题（`module === 'patterns'` 且 `content.chordType === 'chord'`）
- **AND** 从筛选结果中随机选题，渲染到五线谱并显示 4 个选项
- **AND** 筛选结果不足 4 题时，显示"题库题量不足，请老师在 ManualCreator 中添加更多和弦题"提示

#### Scenario: 批量生成填充题库
- **WHEN** 教师在 ManualCreator 和弦模式下点击"一键生成 12 调大三和弦"
- **THEN** 一次性生成 C/F/G/D/A/E/B/Bb/Eb/Ab/Db/Gb 的 Major 和弦（共 12 道），均以原位柱式存入素材池

### Requirement: Chord Difficulty Auto-Calculation
系统 SHALL 根据和弦性质、转位和显示模式自动计算难度。

#### Scenario: 基础三和弦难度
- **WHEN** 和弦类型为 Major 或 Minor 且原位且柱式显示
- **THEN** 难度为 1-2

#### Scenario: 减三/增三和弦难度
- **WHEN** 和弦类型为 Diminished 或 Augmented
- **THEN** 难度为 3

#### Scenario: 七和弦难度
- **WHEN** 和弦类型为 Dom7/Maj7/Min7
- **THEN** 难度为 4

#### Scenario: 转位增加难度
- **WHEN** 和弦为非原位
- **THEN** 难度 +1

#### Scenario: 分解显示增加难度
- **WHEN** displayMode 为 arpeggio
- **THEN** 难度 +1

### Requirement: MusicXML Chord Import Enhancement
MusicXML 导入 SHALL 将解析到的柱式和弦存储到 `patterns` 模块而非 `theory` 模块，并调用 `analyzeChord` 自动识别和弦名。

#### Scenario: 自动和弦识别导入
- **WHEN** 教师上传的 MusicXML 包含柱式和弦（`<chord>` 标签）
- **THEN** 解析结果存入 `patterns` 模块，`chordName` 字段填入自动识别结果
- **AND** `displayMode` 设为 `'block'`
