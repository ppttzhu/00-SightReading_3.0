## ADDED Requirements

### Requirement: Interval Practice Mode Entry
Theory（双音/音程）模块 SHALL 提供"练习模式"入口，与 Notes 模块的练习/闯关 toggle 布局一致。用户可在"闯关模式"和"练习模式"之间切换。

#### Scenario: 从 Theory 模块进入练习模式
- **WHEN** 用户在 `/client/module/theory` 页面点击"练习模式"标签
- **THEN** 显示音程练习的参数配置区（音程类型、方向、谱号、音程模式）
- **AND** 显示"开始练习"按钮

#### Scenario: 默认参数
- **WHEN** 用户首次进入练习模式（未修改任何参数）
- **THEN** 音程类型 = 随机，方向 = 随机，谱号 = 自动，音程模式 = 随机

### Requirement: Rule-Based Interval Generation
系统 SHALL 基于用户选择的参数规则随机生成音程题目，而非从提取题库中抽取。生成 MUST 保证两个音均落在 C2–C7 范围内。

#### Scenario: 生成指定类型的音程
- **WHEN** 用户选择音程类型 = "三度" 并开始练习
- **THEN** 系统随机生成小三度(3半音)或大三度(4半音)的任意方向组合
- **AND** 起始音和目标音均不超出 C2–C7

#### Scenario: 随机类型生成
- **WHEN** 用户选择音程类型 = "随机"
- **THEN** 系统从 1–12 半音范围随机选择，生成任意音程类型

#### Scenario: 方向约束
- **WHEN** 用户选择方向 = "上行"
- **THEN** 目标音始终 ≥ 起始音（音高不低于起始音）

#### Scenario: 起始音范围保证
- **WHEN** 系统生成音程时
- **THEN** 根据所选半音范围和方向反推起始音的合法范围
- **AND** 确保目标音不超出 C2–C7

### Requirement: Melodic and Harmonic Interval Rendering
系统 SHALL 支持两种音程渲染模式：旋律音程（两音并排）与和声音程（两音叠置）。

#### Scenario: 旋律音程渲染
- **WHEN** 音程模式 = "旋律音程"（或随机选中旋律）
- **THEN** 两个音以二分音符左右并排渲染在单谱表上

#### Scenario: 和声音程渲染
- **WHEN** 音程模式 = "和声音程"（或随机选中和声）
- **THEN** 两个音以全音符垂直叠置渲染在单谱表上
- **AND** 若两音均有升降号，下方音的临时记号向左偏移避免碰撞

#### Scenario: 小二度和声音程的视觉处理
- **WHEN** 和声音程的两音音高差 ≤ 2 半音（小二度/大二度）
- **THEN** 上音略微向右偏移，避免符头重叠

### Requirement: Clef Auto-Detection
系统 SHALL 使用两音的 MIDI 中点值自动判定谱号，与 Notes 练习模式逻辑一致。用户可覆盖为仅高音谱号或仅低音谱号。

#### Scenario: 中点法自动判定谱号
- **WHEN** 谱号参数 = "自动"
- **THEN** 计算两音 MIDI 编号的平均值
- **AND** 均值 ≥ E4 → 高音谱号；均值 ≤ A3 → 低音谱号；均值在 A3–E4 之间 → 随机

#### Scenario: 用户指定谱号
- **WHEN** 谱号参数 = "高音谱号" 或 "低音谱号"
- **THEN** 所有题目使用用户指定的谱号，忽略中点法

### Requirement: Interval Answer Options
系统 SHALL 根据当前音程类型的参数动态构建选项列表，包含正确答案和 3 个同类干扰项。

#### Scenario: 指定类型时选项限定
- **WHEN** 用户选择音程类型 = "五度"
- **THEN** 选项仅包含"纯五度 (P5)"正确答案 + 从四度/六度/八度等相邻类型中选取的干扰项

#### Scenario: 随机类型时全量选项
- **WHEN** 用户选择音程类型 = "随机"
- **THEN** 选项池包含全部 12 种音程名称（小二度～纯八度 + 三全音）

### Requirement: Wrong Answer Visual Annotation
用户答错时，系统 SHALL 在乐谱上绘制一条连接两音的音程弧线，标注正确的音程名称。

#### Scenario: 错误时展示弧线标注
- **WHEN** 用户提交错误答案
- **THEN** 在 VexFlow 渲染区绘制一条彩色弧线连接两个音符
- **AND** 弧线上方标注正确的音程名称（如"纯五度 P5"）
- **AND** 弧线在 1.5 秒后自动消失

### Requirement: Parameter Persistence via URL
练习模式的参数 SHALL 通过 URL query params 传递，确保刷新页面或分享链接时参数不丢失。

#### Scenario: URL 携带参数
- **WHEN** 用户点击"开始练习"
- **THEN** 导航至 `/client/practice/intervals?type=<type>&direction=<dir>&clef=<clef>&mode=<mode>`
- **AND** `IntervalPractice` 组件从 URL 读取所有参数

### Requirement: Keyboard Input Scope Exclusion
物理键盘 C/D/E/F/G/A/B 作答 MUST NOT 在音程练习模式中生效。

#### Scenario: 键盘输入不触发作答
- **WHEN** 用户在音程练习模式中按下物理键 C/D/E/F/G/A/B
- **THEN** 系统 MUST NOT 提交任何答案
