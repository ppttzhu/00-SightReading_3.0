# Quiz Practice

## Overview
The quiz practice system provides interactive music learning exercises with multiple question types (notes, symbols, intervals/theory, patterns).

## Schema

### Slice Content Types

#### NoteContent (单音题目)
```typescript
interface NoteContent {
  pitch: string;      // e.g., "C4", "F#5"
  raw: string;        // raw input string
  placement: StaffPlacement;  // 'auto' | 'treble' | 'bass'
}
```

#### SymbolContent (音乐符号题目)
```typescript
interface SymbolContent {
  symbol: string;     // e.g., "ff", "staccato"
  answer: string;     // e.g., "极强 (fortissimo)"
}
```

#### IntervalContent (双音/音程题目)
```typescript
interface IntervalContent {
  noteA: string;      // 第一个音，如 "C4"
  noteB: string;      // 第二个音，如 "G4"
  theory: string;     // 音程名称，可编辑
  placement: StaffPlacement;  // 'auto' | 'treble' | 'bass'
  options: string[] | null;  // 手动配置的选项，null 表示自动生成
  raw: string;        // 保留旧格式兼容
}

// 旧版格式（向后兼容）
interface LegacyIntervalContent {
  theory: string;
  notes: string[];    // [noteA, noteB]
  raw: string;
}
```

#### PatternContent (音型题目)
```typescript
interface PatternContent {
  pattern: string;
  raw: string;
  notes?: string[];
}
```

### Staff Placement
```typescript
type StaffPlacement = 'auto' | 'treble' | 'bass';
```

## Requirements

#### Staff Placement Selection
- Quiz creator can specify placement: 'auto', 'treble', or 'bass'
- When 'auto', the system resolves placement based on pitch range
- For interval questions, placement determines which grand staff the notes appear on

#### Option Generation
- Manual options: when `options` array is provided, use it directly
- Auto options: generate from predefined pool of distractors
- Each quiz shows 4 options (1 correct + 3 distractors)

#### Rendering
- Notes: single note on grand staff
- Intervals: two notes displayed on grand staff
- Symbols: text display without notation
- Patterns: multi-note sequence on single staff

## Affected By
- `add-interval-practice-mode` - interval practice mode additions