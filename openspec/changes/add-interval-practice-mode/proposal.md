# Change: Add Interval Practice Mode

## Why
当前双音/音程模块仅有"闯关模式"，题库来自 MusicXML 提取，题目数量有限且会穷尽。需要像 Notes 模块一样，增加一个基于规则随机生成的"练习模式"，实现无限出题。

## What Changes
- 为 Theory（双音/音程）模块新增"练习模式"入口，UI 与 Notes 练习模式一致
- 新增 `IntervalPractice.tsx` 组件，基于规则随机生成音程题目
- 支持参数配置：音程类型、方向、谱号、音程模式（旋律/和声）
- 和声音程使用 VexFlow 双音叠置渲染
- 自动判定谱号（中点法），单谱表方案
- 可选听音训练开关（Web Audio API 播放双音）

## Impact
- Affected specs: `interval-practice` (new)
- Affected code: `StageSelector.tsx`, `PracticeQuiz.tsx` (参考模式), 新增 `IntervalPractice.tsx`, `useAppStore.ts` (路由无变化，通过 query params 传参)
