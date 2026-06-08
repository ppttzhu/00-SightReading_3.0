## Context

### 现状
- `patterns`（音型）模块当前内容为空，仅有 8 个硬编码音型名和对应的预设音符
- 教师需要在 patterns 模块中出"写几个音，判断是什么和弦"的题目
- 教师端出题有难度：教师可能写分解和弦（C4-E4-G4），但问的是和弦名
- 学生端显示还好，但需要支持和弦名识别而非音型名识别

### 相关代码
- `src/core/store/useAppStore.ts` — `PatternContent` 接口在此定义
- `src/pages/cms/ManualCreator.tsx` — 教师手动出题器
- `src/pages/client/InteractiveQuiz.tsx` — 学生答题渲染（patterns 分支在 454-498 行）
- `src/core/engine/Extractors.ts` — MusicXML 提取器（chord 提取在 301-344 行）
- `src/pages/client/FreePracticeHub.tsx` — 自由练习入口

### 约束
- 不新增顶层模块类型（保留 `notes | symbols | theory | patterns` 四种）
- 和弦题和传统音型题共存于 patterns 模块，通过 `chordType` 字段区分
- 不修改现有闯关模式的答题流程
- **练习模式 Phase 1-3 只从题库出题**，不内置和弦生成器。题库不足时由 ManualCreator 批量生成能力弥补
- **Phase 1-2 柱式渲染只支持 3-4 音和弦**（三和弦和七和弦），5+ 音为 Phase 4 增强
- 和弦名以音高输入中的字母名为准，半音集合仅用于模板匹配

## 决策

### Decision 1：不新增模块，扩展 PatternContent

| 选项 | 评价 |
|------|------|
| 新增第 5 个模块 `chords` | 引入整个模块生命周期（路由/筛选/统计），收益不高 |
| 归入 `theory` 模块 | 和弦是"3+音集合"，和"2 音音程"认知任务不同，语义不对 |
| **归入 `patterns` 模块** | ✅ patterns 本就是处理"多个音的组合"，语义贴合，复用完整流程 |

**结论**：和弦识别作为 patterns 的子类型存在。

### Decision 2：和弦分析算法——音高输入中的字母名作为最终和弦名依据

算法分为两步：

**步骤 A（半音模板匹配）**：输入音高集合（老师写的任意排列）→ 归一化为半音集合 → 以每个音为候选根音，匹配预定义和弦模板 → 确定最佳匹配的根音音高类和性质

**步骤 B（字母名推导）**：半音集合只决定"这是什么性质的音程结构"，不决定和弦名的字母拼写。和弦的字母名（root display name）从输入音高列表中的最低音或根音候选的字母名推导。

例如 `Db4, F4, Ab4` 半音集合是 `{1, 5, 8}`，模板匹配到 Major（偏移 [0,4,7] 映射后为根音 1）。步骤 B 检查输入中有 `Db`，根音名用 `Db` 而非 `C#`，结果为 `Db Major`。

"原位优先于转位、精确匹配优先于超集"解决歧义。

### Decision 3：教师输入双模式

- **快速选择模式**（覆盖 80% 场景）：根音 + 性质 + 转位，3 次点击出题
- **自定义音高模式**（覆盖 20% 场景）：输入音高列表，系统自动识别，教师确认

### Decision 4：柱式和弦用 VexFlow 多音 StaveNote，分解和弦复用现有逻辑

- `block` 模式：`new StaveNote({ keys: ['c/4', 'e/4', 'g/4'], duration: 'w' })`
- `arpeggio` 模式：复用 InteractiveQuiz.tsx 中 patterns 的 `duration: 'q'` 序列渲染
- **Phase 1-2 只支持 3-4 音和弦**，VexFlow 的 `keys` 数组长度 ≤ 4。5+ 音和弦（如 Cmaj9）留到 Phase 4 增加渲染边界处理
- 大谱表拆分：Phase 1-2 沿用现有 theory 模块的逻辑——根据音高中位数选一个谱表渲染，不跨谱表拆分

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| VexFlow 柱式和弦升降号重叠 | 参考现有和声音程 accidental 偏移逻辑；先只支持 3-4 音 |
| 和弦歧义（C-E-G-A = C6 or Am7） | 快速选择模式无此问题；自定义模式下列出所有可能让教师选 |
| 分解和弦的八度重复音干扰识别 | 音高集合归一化时去重 |
| 和现有 patterns 传统题型冲突 | 通过 `chordType` 字段区分，渲染时分支判断 |
| 🔴 练习模式题源不明确 | Phase 1-3 明确只从题库出题，不做内置生成器。FreePracticeHub 在题库不足时显示提示 |
| 🔴 等音拼写导致和弦名错误 | 和弦名的字母拼写从输入音高字母名推导，不靠半音集合反推 |
| 🔴 VexFlow 5+ 音和弦渲染失败 | Phase 1-2 明确限制 3-4 音，不碰 5+；大谱表不分拆 |
| MusicXML `<chord>` 标签在持续音场合漏音 | 导入后提供"审核模式"让老师快速浏览修正 |
| `buildContent` 函数在新分支下膨胀到 200+ 行 | 提前抽出 `buildChordContent` 独立函数 |
