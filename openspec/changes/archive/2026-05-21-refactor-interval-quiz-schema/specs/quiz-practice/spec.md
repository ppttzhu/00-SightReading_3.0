## MODIFIED Requirements
### Requirement: 客户端在闯关模式 SHALL 根据关卡的 `questionCount` 决定题目数量
客户端在闯关模式 SHALL 根据关卡的 `questionCount` 决定题目数量。若 `questionCount` 大于关卡实际关联的题目数，SHALL 使用有放回随机抽样（题目可重复出现）。**系统 SHALL 支持双音/音程题目的特殊渲染需求：按 placement 选择谱表，并使用两条独立五线谱。**

#### Scenario: 双音题目渲染时根据 placement 选择谱表
- **WHEN** 双音题目的 `content.placement = 'treble'`
- **THEN** 两个音符都应在高音谱表上渲染
- **WHEN** 双音题目的 `content.placement = 'bass'`
- **THEN** 两个音符都应在低音谱表上渲染
- **WHEN** 双音题目没有 `placement` 字段（旧数据）
- **THEN** 系统 SHALL 根据两个音符的音高范围自动选择谱表

#### Scenario: 双音题目使用两条独立五线谱
- **WHEN** 系统渲染双音题目
- **THEN** SHALL 使用两条独立的五线谱（高音+低音），而非大谱表联动
- **AND** 两个音符分别显示在对应谱表上

## ADDED Requirements
### Requirement: 双音题目选项配置
系统 SHALL 支持教师为双音题目手动配置答案选项。

#### Scenario: 手动配置选项
- **WHEN** 教师在 CMS 创建双音题目并选择了"手动输入选项"
- **THEN** 教师可输入自定义选项列表（如 ["大三度", "小三度", "纯四度", "大二度"]）
- **AND** 系统 SHALL 将 `options` 字段保存到题目 content 中

#### Scenario: 使用自动生成选项
- **WHEN** 教师在 CMS 创建双音题目并选择了"自动生成选项"
- **THEN** 系统 SHALL 不设置 `options` 字段（或设为空数组）
- **AND** 客户端出题时 SHALL 使用默认策略生成选项

#### Scenario: 客户端读取手动配置的选项
- **WHEN** 双音题目的 `content.options` 包含非空数组
- **THEN** 系统 SHALL 直接使用该数组作为选项列表
- **AND** SHALL 从数组中随机选取 4 个（含正确答案），不足则补充
- **AND** SHALL 将选项随机打乱后展示

#### Scenario: 客户端自动生成选项的回退逻辑
- **WHEN** 双音题目没有 `options` 或 `options` 为空
- **THEN** 系统 SHALL 使用 IntervalPractice 的现有策略生成选项
- **AND** 选项 SHALL 包含同度数干扰项（如选择大三度时，至少包含一个小三度作为干扰项）

### Requirement: CMS 双音题目出题交互
教师在 CMS 创建双音题目时 SHALL 使用以下交互模式：教师输入两个具体音高（A 和 B），系统自动计算并显示音程名称作为辅助确认，教师可选择手动调整。

#### Scenario: 直接输入两个音
- **WHEN** 教师在 CMS 双音出题界面
- **THEN** 教师可分别选择音A（如 C4）和音B（如 G4）
- **AND** 系统 SHALL 自动显示计算出的音程名称（如"纯五度 (P5)"）
- **AND** 教师可编辑该音程名称以覆盖自动计算结果

#### Scenario: 自动计算音程方向
- **WHEN** 系统显示自动计算的音程名称
- **THEN** SHALL 根据 noteA 和 noteB 的相对音高确定方向
- **AND** 上行/下行由两个音的 MIDI 值决定，无需单独配置

#### Scenario: 批量导入时 placement 标记
- **WHEN** 教师使用批量导入模式创建双音题目
- **THEN** 系统 SHALL 支持与单音相同的谱号标记语法
- **AND** `[高音]` 标记表示两个音都在高音谱表
- **AND** `[低音]` 标记表示两个音都在低音谱表
- **AND** `[自动]` 标记表示系统根据音高自动判断（默认）
- **AND** 批量格式示例：`[高音]\nC4,G4\nD4,A4`

### Requirement: 双音题目 Schema
双音/音程题目的 content 结构 SHALL 包含以下字段：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `noteA` | string | 是 | 第一个音，如 "C4" |
| `noteB` | string | 是 | 第二个音，如 "E4" |
| `placement` | 'treble' \\| 'bass' \\| null | 否 | 谱号，未指定时自动判断 |
| `answer` | string | 是 | 正确答案，如 "小三度 (m3)" |
| `options` | string[] | 否 | 手动配置的选项，为空时自动生成 |
| `raw` | string | 是 | 原始字符串（向后兼容） |

#### Scenario: 旧数据迁移
- **WHEN** 系统加载没有 `noteA`/`noteB` 字段的双音题目（旧格式）
- **THEN** 系统 SHALL 从 `content.notes` 数组中读取 `notes[0]` 作为 `noteA`，`notes[1]` 作为 `noteB`
- **AND** SHALL 从 `content.theory` 读取 `answer`
- **AND** SHALL 保持 `raw` 字段不变用于调试

### Requirement: 迁移脚本
系统 SHALL 提供迁移脚本将旧格式双音题目批量转换为新格式。

#### Scenario: 一次性迁移
- **WHEN** 执行迁移脚本
- **THEN** 脚本 SHALL 遍历所有 `module = 'theory'` 的题目
- **AND** SHALL 将 `content.notes` 转换为 `content.noteA` + `content.noteB`
- **AND** SHALL 将 `content.theory` 重命名为 `content.answer`
- **AND** SHALL 根据两个音符的音高范围设置 `content.placement`
- **AND** SHALL 保留 `content.raw` 字段
