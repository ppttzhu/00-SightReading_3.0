# Change: 音型模块增加和弦识别功能 (Chord Identification)

## Why

当前 `patterns`（音型）模块内容为空，教师希望用它来实现"写几个音，让学生判断是什么和弦"的出题需求。但和弦题的教师出题端存在两个痛点：(1) 教师可能写分解和弦而非柱式和弦，导致存储和判题复杂；(2) 手动输入多个音高+正确和弦名对教师不够友好。

## What Changes

- 新增和弦分析引擎 `chordAnalyzer.ts`，将任意音高集合自动识别为和弦名
- 扩展 `PatternContent` 以支持和弦识别子类型
- ManualCreator 中 patterns 类型新增"和弦识别"子模式（含快速选择和自定义音高两种输入方式）
- InteractiveQuiz 中 patterns 分支新增柱式和弦和分解和弦渲染
- 新增和弦练习模式入口及筛选器
- MusicXML 导入增强：自动将曲谱中的和弦提取到 patterns 模块并识别

## Impact

- Affected specs: `quiz-practice` (PatternContent 数据模型), `chord-practice` (新增)
- Affected code: `useAppStore.ts` (PatternContent 扩展), `ManualCreator.tsx` (和弦 UI), `InteractiveQuiz.tsx` (和弦渲染), `Extractors.ts` (导入增强), `FreePracticeHub.tsx` (入口), 新增 `chordAnalyzer.ts`
