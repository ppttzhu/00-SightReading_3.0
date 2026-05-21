# Change: 双音/音程题库管理重构

## Why
当前双音/音程模块题库管理存在以下问题：
1. 出题时不指定谱号（placement），导致渲染时可能选错谱表
2. 选项自动生成，无法手动配置干扰项
3. 与单音模块的 schema 不一致，关卡复用逻辑不一致

## What Changes
- 出题交互改为：教师直接选择两个音（A 和 B），系统自动计算并显示音程名称（可编辑）
- 重构双音题目的 content schema，增加 `noteA`、`noteB`、`placement`、`options` 字段
- 在 ManualCreator 的双音出题界面增加选项配置（手动输入或自动生成）
- InteractiveQuiz 出题时读取 `placement` 和 `options`，未配置则使用默认逻辑
- 编写迁移脚本将旧格式题目转换为新格式

## Impact
- Affected specs: `quiz-practice`
- Affected code:
  - `src/pages/cms/ManualCreator.tsx` - 出题界面
  - `src/pages/client/InteractiveQuiz.tsx` - 出题逻辑
  - `docs/data/migration.sql` - 迁移脚本
