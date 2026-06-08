# 和弦识别模块设计文档（音型模块）

> 归属模块：`patterns`（音型） 
> 当前状态：该模块内容为空，需要从零设计

---

## 0. 为什么放在 patterns 而不是 theory

现有的 4 个模块中，和弦识别的定位是：

```
| 模块         | 当前内容                     | 学生要做的事           |
|-------------|-----------------------------|-----------------------|
| notes       | 单音 C4, F#5 …              | 认单个音在五线谱的位置 |
| symbols     | ff, staccato, fermata …     | 认音乐表情记号         |
| theory      | 双音音程 C4-G4、调号 …       | 认两个音之间的关系     |
| patterns    | （空）← 和弦识别放这里        | 认多个音构成的和弦      |
```

和弦的核心特征是 **3 个以上音的集合**，和双音/音程（theory）是两种不同的认知任务，放在 theory 里会混淆。而 patterns 本来就面向"把一组音当做一个整体来识别"，语义上更贴合。

---

## 1. 数据模型

扩展现有 `PatternContent`，添加和弦相关字段：

```typescript
/** 音型题目 content（扩展后支持和弦识别） */
export interface PatternContent {
  pattern: string;          // 通用：音型名称，或和弦题中留空
  raw: string;              // 显示用原始字符串
  notes?: string[];         // 通用：音符列表，和弦题时存和弦音高
  options?: string[];       // 通用：自定义选项

  // 和弦识别专用字段
  chordType?: 'chord';      // 标记这是和弦题而非传统音型题
  chordName?: string;       // 和弦答案，如 'C Major'
  inversion?: string;       // 转位信息 'root' | '1st' | '2nd' | '3rd' | ''
  displayMode?: 'block' | 'arpeggio';  // 柱式还是分解显示
}
```

### 存储示例

```typescript
// C 大三和弦，根音位置，柱式显示
{
  id: 'chord_1749000000000',
  module: 'patterns',
  content: {
    pattern: '',
    raw: 'C4,E4,G4|C Major',
    notes: ['C4', 'E4', 'G4'],
    chordType: 'chord',
    chordName: 'C Major',
    inversion: 'root',
    displayMode: 'block',
  },
  difficulty: 1
}

// A 小三和弦，分解显示
{
  id: 'chord_1749000000001',
  module: 'patterns',
  content: {
    pattern: '',
    raw: 'A3,C4,E4|A Minor',
    notes: ['A3', 'C4', 'E4'],
    chordType: 'chord',
    chordName: 'A Minor',
    inversion: 'root',
    displayMode: 'arpeggio',
  },
  difficulty: 1
}

// G7 属七和弦
{
  id: 'chord_1749000000002',
  module: 'patterns',
  content: {
    pattern: '',
    raw: 'G3,B3,D4,F4|G7',
    notes: ['G3', 'B3', 'D4', 'F4'],
    chordType: 'chord',
    chordName: 'G7',
    inversion: 'root',
    displayMode: 'block',
  },
  difficulty: 4
}
```

---

## 2. 和弦分析引擎

### 新增文件

`src/core/engine/chordAnalyzer.ts`

### 核心算法

```
输入：音高列表 ['C4', 'E4', 'G4']
输出：{ root: 'C', quality: 'Major', name: 'C Major', inversion: 'root' }
```

步骤：

```
1. 音高归一化
   C4, E4, G4, C5 → 音名集合 {C, E, G} → 音高类 {0, 4, 7}

2. 候选根音尝试
   以每个音为根音，计算各音到根音的半音数：
   - 以 C 为根音：{0, 4, 7} → 匹配 Major ✓（原位评分最高）
   - 以 E 为根音：{0, 4, 9} → 无匹配
   - 以 G 为根音：{0, 5, 9} → 无匹配

3. 返回最佳匹配 → C Major, root
```

### 和弦模板库

```typescript
const CHORD_TEMPLATES = [
  // 三和弦（3 音）
  { name: 'Major',       semitones: [0, 4, 7],    difficulty: 1 },
  { name: 'Minor',       semitones: [0, 3, 7],    difficulty: 1 },
  { name: 'Diminished',  semitones: [0, 3, 6],    difficulty: 3 },
  { name: 'Augmented',   semitones: [0, 4, 8],    difficulty: 3 },
  { name: 'Sus2',        semitones: [0, 2, 7],    difficulty: 2 },
  { name: 'Sus4',        semitones: [0, 5, 7],    difficulty: 2 },

  // 七和弦（4 音）
  { name: 'Dom7',        semitones: [0, 4, 7, 10],  difficulty: 4 },
  { name: 'Maj7',        semitones: [0, 4, 7, 11],  difficulty: 4 },
  { name: 'Min7',        semitones: [0, 3, 7, 10],  difficulty: 4 },
  { name: 'MinMaj7',     semitones: [0, 3, 7, 11],  difficulty: 5 },
  { name: 'Dim7',        semitones: [0, 3, 6, 9],   difficulty: 5 },
  { name: 'HalfDim7',    semitones: [0, 3, 6, 10],  difficulty: 5 },
  { name: 'Aug7',        semitones: [0, 4, 8, 10],  difficulty: 5 },
  { name: 'Dom7sus4',    semitones: [0, 5, 7, 10],  difficulty: 4 },
];
```

### 识别函数签名

```typescript
export interface ChordAnalysis {
  root: string;           // 根音音名，如 'C'
  quality: string;        // 和弦性质，如 'Major'
  name: string;           // 完整名称，如 'C Major'
  inversion: string;      // 'root' | '1st' | '2nd' | '3rd'
  confidence: number;     // 0-1 置信度
}

export function analyzeChord(pitches: string[]): ChordAnalysis | null;
```

### 难度自动计算

```typescript
function calcChordDifficulty(quality: string, inversion: string, displayMode: string): number {
  let base = CHORD_TEMPLATES.find(t => t.name === quality)?.difficulty ?? 3;
  if (inversion !== 'root') base += 1;
  if (displayMode === 'arpeggio') base += 1;
  return Math.min(10, Math.max(1, base));
}
```

### 歧义处理规则

```
优先级：
1. 原位 > 转位（最低音作为根音最优先）
2. 精确匹配 > 超集匹配（写了 3 个音优先匹配三和弦）
3. 常用 > 非常用（Major > Augmented）
4. 仍无法确定 → 列出所有可能，让教师选择
```

---

## 3. 教师出题流程

### 3.1 手动出题器界面

`ManualCreator.tsx` 中 `type === 'patterns'` 时，增加和弦子模式：

```
┌─────────────────────────────────────────────────────────────┐
│  音型 / 和弦识别出题                                        │
│                                                             │
│  题目类型: [● 和弦识别]  [○ 传统音型]                        │
│                                                             │
│  ═══════════════════════════════════════════════════════════ │
│                                                             │
│  ── 快速选择 ─────────────────────────────────────────────  │
│                                                             │
│  根音: [C] [D] [E] [F] [G] [A] [B]   [♭] [♯]              │
│                                                             │
│  性质: [大三] [小三] [减三] [增三]                           │
│        [属七] [大七] [小七]                                  │
│                                                             │
│  转位: [原位] [第一] [第二]  □ 不要求识别转位                 │
│  显示: [● 柱式]  [○ 分解]                                   │
│                                                             │
│  ┌────────────────────────────────────────┐                  │
│  │  VexFlow 实时预览区域                   │                  │
│  │                                        │                  │
│  │  大谱表上显示：根音=C 性质=Major 原位    │                  │
│  │  → C4 E4 G4 柱式和弦                   │                  │
│  │                                        │                  │
│  └────────────────────────────────────────┘                  │
│                                                             │
│  ── 或 自定义音高 ────────────────────────────────────────── │
│                                                             │
│  音高: [C4, E4, G4, Bb4                         ] [▼]       │
│        ↑ 自动补全                                   │
│                                                             │
│  系统识别: G7 (属七和弦)  [确认] [修改▼]                      │
│                     ↑ 点击可看其他可能            │
│                                                             │
│  ──────────────────────────────────────────────────────────  │
│                                                             │
│  干扰项: [C Major | D Minor | Am7            ] [↺ 自动生成] │
│                                                             │
│  难度: ═══●═══════════ 4 (自动)                              │
│                                                             │
│  [+ 添加到素材池]                                            │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 批量输入格式

与现有批量模式一致，和弦格式：

```
# 和弦批量输入
C4,E4,G4|C Major|F Major|A Minor|G Major
A3,C4,E4|A Minor|D Minor|E Minor|C Major
G3,B3,D4,F4|G7|C Major|Dm7|Am7
F3,A3,C4,F4|F Major|C Major|Bb Major|D Minor
```

### 3.3 MusicXML 导入

现有 `extractPoolC`（`Extractors.ts:301-344`）把 MusicXML 中的和弦提取为 `和弦: C4+E4+G4` 存在 theory 模块。新增时改为调用 `chordAnalyzer`，存入 `patterns` 模块：

```typescript
if (chordGroup.length >= 2) {
  const sorted = [...chordGroup].sort((a, b) => a.midi - b.midi);
  const noteNames = sorted.map(p => p.name);
  const analysis = analyzeChord(noteNames);

  slices.push({
    id: `patterns_chord_${idx}_${noteNames.join('_')}`,
    module: 'patterns',
    content: {
      pattern: '',
      raw: noteNames.join(',') + '|' + (analysis?.name ?? '未知'),
      notes: noteNames,
      chordType: 'chord',
      chordName: analysis?.name ?? '未知和弦',
      inversion: analysis?.inversion ?? 'root',
      displayMode: 'block',   // MusicXML 柱式和弦 → block
    },
    difficulty: analysis ? calcChordDifficulty(analysis.quality, analysis.inversion, 'block') : 5,
  });
}
```

---

## 4. 学生端渲染

### 4.1 InteractiveQuiz.tsx 的 patterns 分支

现有代码 `InteractiveQuiz.tsx:454-498` 处理 patterns 模块。需要增加和弦判断：

```typescript
} else if (currentSlice.module === 'patterns') {
  const content = currentSlice.content as unknown as Record<string, unknown>;

  if (content.chordType === 'chord') {
    // ── 和弦识别题 ──
    renderChordQuestion(context, stave, content);
  } else {
    // ── 传统音型题（现有逻辑） ──
    renderTraditionalPattern(context, stave, content);
  }
}
```

### 4.2 柱式和弦渲染（block）

和弦题默认用全音符柱式，多音叠加：

```typescript
function renderChordBlock(
  context: RenderContext,
  stave: Stave,
  notes: string[],
  clef: string
) {
  const vfKeys = notes.map(n => {
    const { key, accidental } = parsePitchForVexflow(n);
    return { key, acc: accidental };
  });

  const chordNote = new StaveNote({
    keys: vfKeys.map(k => k.key),
    duration: 'w',
    clef,
  });

  vfKeys.filter(k => k.acc).forEach(k => {
    chordNote.addModifier(new Accidental(k.accidental!));
  });

  const voice = new Voice({ numBeats: 4, beatValue: 4 });
  voice.setMode(2);
  voice.addTickables([chordNote]);
  new Formatter().joinVoices([voice]).format([voice], 280);
  voice.draw(context, stave);
}
```

### 4.3 分解和弦渲染（arpeggio）

复用现有 patterns 模块的四分音符序列渲染，和弦音逐个出现。

### 4.4 选项生成

```typescript
function generateChordOptions(slice: Slice): string[] {
  const content = slice.content as unknown as Record<string, unknown>;

  // 教师自定义选项优先
  const fixedOptions = content.options as string[] | undefined;
  if (fixedOptions?.length >= 2) return [...fixedOptions];

  const correct = (content.chordName as string) || '';
  if (!correct) return ['—', '—', '—', '—'];

  // 根据难度确定和弦池
  const difficulty = slice.difficulty;
  const pool = getAllChordNames().filter(name => {
    const d = getChordDifficulty(name);
    return Math.abs(d - difficulty) <= 2;  // 难度相近的和弦
  });

  const distractors = pool
    .filter(n => n !== correct)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  return shuffle([correct, ...distractors]);
}
```

**干扰项优化**：
- 相同音数的和弦互相干扰（3 音对 3 音、4 音对 4 音）
- 相同调性的和弦互相干扰（C Major 旁放 F Major 比放 F# Major 好）
- 教师可以手动指定

---

## 5. 学生练习：具体例子

### 例 1：C Major 柱式和弦（入门）

```
学生看到：

   ♩ = C4
  ♩♩ = E4、G4
  ───
  高音谱表上的柱式 C 大三和弦

选项：
  ○ C Major        ← 正确
  ○ G Major
  ○ A Minor  
  ○ F Major

答对 → +10 分，绿框提示 "C Major ✓"
答错 → 红框，显示正确答案
```

### 例 2：A Minor 分解和弦（入门）

```
学生看到：

  ♩  ♩  ♩  ♩
  A3 C4 E4 A4
  低音谱表 → 高音谱表的分解琶音

选项：
  ○ A Minor       ← 正确
  ○ C Major
  ○ E Minor
  ○ D Minor
```

### 例 3：G7 柱式和弦（中级）

```
学生看到：

  ♩ = G4
 ♩♩ = B4、D5  (柱式)
♩   = F5

选项：
  ○ G7            ← 正确
  ○ C Major
  ○ Dm7
  ○ Am7
```

### 例 4：C/E 转位和弦（进阶）

```
学生看到：

  ♩ = E4
 ♩♩ = G4、C5

选项（教师勾选了"识别转位"时）：
  ○ C/E（C Major 第一转位）← 正确
  ○ C Major（根音位置）
  ○ F/A
  ○ G/B

选项（教师没勾"识别转位"时）：
  ○ C Major        ← 正确
  ○ G Major
  ○ A Minor
  ○ F Major
```

### 例 5：从现有 patterns 出的传统音型题（留做对比）

```
学生看到：

  ♩  ♩  ♩  ♩  ♩  ♩
  C4 D4 E4 F4 G4 A4

选项：
  ○ 上行音阶跑动  ← 正确
  ○ 下行音阶跑动
  ○ 分解和弦
  ○ 琶音上行

※ 和弦识别题和传统音型题共存于 patterns 模块
```

---

## 6. 练习流设计

### 6.1 自由练习入口

在 `FreePracticeHub` 中增加"和弦识别"入口卡片：

```
┌──────────────────────────────────────────────────────┐
│  Free Practice Hub                                    │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │  单音     │  │ 表情记号  │  │ 音程/和弦 │           │
│  │  认位置   │  │ 认符号   │  │ 认关系   │           │
│  └──────────┘  └──────────┘  └──────────┘           │
│                                                       │
│  ┌──────────┐  ┌──────────┐                          │
│  │  音型     │  │  和弦识别 │  ← 新增入口             │
│  │  认模式   │  │  认和弦  │                          │
│  └──────────┘  └──────────┘                          │
└──────────────────────────────────────────────────────┘
```

### 6.2 和弦筛选器

点击后进入筛选设置：

```
┌─────────────────────────────────────────────────────┐
│  和弦练习设置                                        │
│                                                      │
│  和弦类型:                                           │
│  [☑ 大三] [☑ 小三] [☐ 减三] [☐ 增三]                   │
│  [☐ 属七]  [☐ 大七]  [☐ 小七]                         │
│                                                      │
│  转位: [☑ 原位] [☐ 第一] [☐ 第二]                      │
│                                                      │
│  显示: [● 柱式] [○ 分解] [○ 随机]                      │
│                                                      │
│  根音范围: C ──────────────── B                        │
│  难度范围: 1 ────●──────── 10                          │
│                                                      │
│  ┌────────────────────────────────────┐              │
│  │ 示例预览：C Major 柱式和弦          │              │
│  │                                   │              │
│  └────────────────────────────────────┘              │
│                                                      │
│  [开始练习]                                           │
└─────────────────────────────────────────────────────┘
```

### 6.3 练习模式

```
答题流程：
1. 从筛选范围内随机选一个和弦 → 渲染到五线谱
2. 显示 4 个选项（正确答案 + 3 个干扰项）
3. 学生选择答案
4. 即时反馈：正确/错误 + 正确答案提示
5. 下一题
6. 结束后显示统计：正确率、用时、常错和弦

数据记录（与现有 recordPractice 一致）：
  { module: 'patterns', sliceId, correct: true/false, timestamp }
```

### 6.4 难度递进建议

| 级别 | 练习内容 | 难度值 |
|------|----------|--------|
| 新手 | C/F/G 大三 + Am/Dm/Em 小三，原位，柱式 | 1-2 |
| 进阶 | 12 个调的大三/小三和弦 | 2-3 |
| 中级 | 加入减三、增三、Sus | 3-4 |
| 中高级 | 加入七和弦（属七、大七、小七） | 4-6 |
| 高级 | 加入转位识别 | 6-8 |
| 挑战 | 所有和弦、所有转位、Dim7/HalfDim7/MinMaj7 | 8-10 |

---

## 7. 出题场景全集

### 场景 1：老师出 5 道入门题给全班

```
操作流程：
1. 打开 ManualCreator → 选 "音型" → 子类型 "和弦识别"
2. 快速模式依次出：
   根音=C  性质=大三  → 添加到素材池
   根音=G  性质=大三  → 添加到素材池
   根音=F  性质=大三  → 添加到素材池
   根音=A  性质=小三  → 添加到素材池
   根音=D  性质=小三  → 添加到素材池
   每道题耗时约 3 秒
3. 打开 StageBuilder → 筛选 patterns 模块 → 全选 → 逐题调整难度
4. 打开 CustomStageEditor → 拉到关卡中
5. 发布

总计：约 30 秒出完 5 道题
```

### 场景 2：老师想出一道 G7 分解和弦

```
操作流程：
1. ManualCreator → 音型 → 和弦识别
2. 自定义音高输入：G3, B3, D4, F4
3. 系统识别 → "G7 (属七和弦) ✓"
4. 显示方式 → 分解
5. 确认 → 添加到素材池
```

### 场景 3：老师上传了一首有大量和弦的谱子

```
操作流程：
1. UploadParser → 上传 MusicXML
2. extractPoolC 增强后自动把和弦提取到 patterns 模块
3. 每个和弦自动识别名称（C Major、G7、Am…）
4. 在 StageBuilder 中批量审核/调整
5. 直接拉到关卡中

自动从 1 首曲子里提取出 10-30 道和弦题
```

### 场景 4：老师想出一道有歧义的和弦题

```
操作流程：
1. 自定义输入：C4, E4, G4, A4
2. 系统弹出歧义提示：
   "检测到多个可能：
    ○ C6 (C Major 6)
    ○ Am7 (A Minor 7)
    请选择或自定义"
3. 老师选择 Am7（因为正在讲小七和弦单元）
4. 确认 → 添加到素材池

歧义不是 bug，反而是老师的教学工具
```

---

## 8. 实施计划

### Phase 1：引擎 + 数据类型（预计 1 天）

- [ ] 新建 `src/core/engine/chordAnalyzer.ts`
  - 基础 chordAnalyzer 函数
  - 10 种常见和弦模板
  - 难度计算函数
- [ ] 扩展 `PatternContent`（新增 chordType/chordName/inversion/displayMode）
- [ ] `areSlicesDuplicate` 增加和弦题去重逻辑

### Phase 2：教师出题端（预计 2 天）

- [ ] ManualCreator 中 patterns 类型新增"和弦识别"子模式
- [ ] 快速选择 UI（根音按钮网格 + 性质按钮网格）
- [ ] 自定义输入 UI（音高输入 + 自动识别 + 歧义处理）
- [ ] 实时 VexFlow 预览（柱式 + 分解）
- [ ] 批量输入支持
- [ ] StageBuilder 中 patterns 筛选显示优化

### Phase 3：学生端（预计 1 天）

- [ ] InteractiveQuiz.tsx patterns 分支新增和弦渲染
- [ ] 柱式和弦 VexFlow 渲染
- [ ] 和弦名选项生成器
- [ ] FreePracticeHub 新增"和弦识别"入口
- [ ] 和弦筛选器组件

### Phase 4：增强（预计 1 天）

- [ ] MusicXML 导入增强（和弦提取到 patterns 模块）
- [ ] 扩展和弦模板库到 20+
- [ ] 钢琴键盘答题模式

---

## 9. 改动文件清单

| 文件 | 改动 |
|------|------|
| `src/core/engine/chordAnalyzer.ts` | **新增** |
| `src/core/store/useAppStore.ts` | 扩展 `PatternContent`，更新 `areSlicesDuplicate` |
| `src/core/engine/Extractors.ts` | `extractPoolC` 增强输出到 patterns 模块 |
| `src/pages/cms/ManualCreator.tsx` | patterns 类型新增和弦子模式 UI |
| `src/pages/cms/StageBuilder.tsx` | 显示优化 |
| `src/pages/client/InteractiveQuiz.tsx` | patterns 分支新增和弦渲染 |
| `src/pages/client/FreePracticeHub.tsx` | 新增入口 |
| `src/pages/client/StageSelector.tsx` | 和弦筛选器（若新增独立页面） |

---

## 10. 风险与注意事项

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 现有 patterns 的 8 个硬编码音型名和和弦题冲突 | 选项池混合 | 通过 `chordType` 区分，两种题型互不干扰 |
| VexFlow 柱式和弦渲染在低音谱表可能重叠 | 视觉混乱 | 自动选一个谱表（取音高中位数决定），必要时 split 到大谱表 |
| 和弦歧义：老师不认同系统的识别 | 出题受阻 | 歧义时列出所有可能让老师选，老师可以自定义输入 |
| 已有题库中的 old-format patterns 题 | 兼容性 | `chordType` 不存在时按传统音型逻辑走 |
