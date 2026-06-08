## 1. 引擎与数据模型

- [x] 1.1 新建 `src/core/engine/chordAnalyzer.ts`，实现 `analyzeChord()` 函数
- [x] 1.2 实现 10 种基础和弦模板（Major/Minor/Dim/Aug/Sus2/Sus4 + Dom7/Maj7/Min7/Dim7）
- [x] 1.3 扩展 `PatternContent` 增加 chordType/chordName/inversion/displayMode 字段
- [x] 1.4 更新 `SliceContent` 联合类型（PatternContent 已包含新字段）
- [x] 1.5 更新 `areSlicesDuplicate` 去重逻辑（和弦题按音高集合去重而非 raw 字符串）
- [x] 1.6 实现 `calcChordDifficulty()` 自动难度计算

## 2. 教师出题端 (CMS)

- [x] 2.1 ManualCreator 中 patterns 类型新增"和弦识别/传统音型"子类型切换
- [x] 2.2 实现快速选择模式 UI：根音按钮网格 + 性质按钮网格 + 转位/显示选项
- [x] 2.3 实现自定义音高输入模式：音高自动补全 + 实时调用 chordAnalyzer + 识别结果展示
- [x] 2.4 实现歧义识别处理：多个和弦匹配时弹出选择，允许教师自定义
- [x] 2.5 实现实时 VexFlow 预览（柱式/分解两种模式，柱式限制 3-4 音）
- [x] 2.6 实现和弦题批量输入（解析 `C4,E4,G4|C Major|...` 格式）
- [x] 2.7 实现"一键批量生成 12 调大三和弦"功能（快速填充题库）
- [x] 2.8 StageBuilder 中 patterns 模块显示优化：区分和弦题和传统音型题

## 3. 学生答题端 (Client)

- [x] 3.1 InteractiveQuiz.tsx patterns 分支中检测 chordType 并分支渲染
- [x] 3.2 实现柱式和弦 VexFlow 渲染（多音叠加全音符）
- [x] 3.3 实现分解和弦 VexFlow 渲染（复用现有四分音符序列逻辑）
- [x] 3.4 实现和弦名选项生成器（按难度筛选同音数干扰项）
- [x] 3.5 FreePracticeHub 新增"和弦识别"入口卡片
- [x] 3.6 实现和弦筛选器组件（和弦类型多选 + 转位 + 显示模式 + 难度范围）
- [x] 3.7 实现和弦自由练习模式（从题库出题而非规则生成；题库不足 4 题时显示提示）

## 4. 增强功能

- [x] 4.1 MusicXML 导入增强：`extractPoolC` 中将和弦改存到 patterns 模块并调用 chordAnalyzer
- [x] 4.2 扩展和弦模板库到 20+ 种（含 HalfDim7、Aug7、Dom7sus4、Maj9 等）
- [ ] 4.3 钢琴键盘答题模式（可选）
