import { MusicXMLParser } from './MusicXMLParser';

// ---------------------------------------------------------
// 四维提取引擎 (Extractors)
// 将乐谱切片，归类进四大分类 (A/B/C/D)
// ---------------------------------------------------------

export interface ExtractedSlice {
  id: string;
  type: 'A' | 'B' | 'C' | 'D';
  content: any;
  difficulty: number;
}

// 音名 -> MIDI 半音编号映射 (用于计算音程)
const STEP_TO_SEMITONE: Record<string, number> = {
  'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11
};

// 音程半音数 -> 名称映射
const INTERVAL_NAMES: Record<number, string> = {
  0: '纯一度 (P1)',
  1: '小二度 (m2)',
  2: '大二度 (M2)',
  3: '小三度 (m3)',
  4: '大三度 (M3)',
  5: '纯四度 (P4)',
  6: '三全音 (TT)',
  7: '纯五度 (P5)',
  8: '小六度 (m6)',
  9: '大六度 (M6)',
  10: '小七度 (m7)',
  11: '大七度 (M7)',
  12: '纯八度 (P8)',
};

// 辅助函数：将音高字符串转换为 MIDI 编号
function pitchToMidi(step: string, octave: number, alter: number): number {
  return (STEP_TO_SEMITONE[step] || 0) + alter + (octave + 1) * 12;
}

// 辅助函数：解析 <note> 元素中的音高信息
function parsePitch(noteEl: Element): { name: string; midi: number } | null {
  const pitchNode = noteEl.querySelector('pitch');
  if (!pitchNode) return null;
  const step = pitchNode.querySelector('step')?.textContent || 'C';
  const octave = parseInt(pitchNode.querySelector('octave')?.textContent || '4');
  const alter = parseInt(pitchNode.querySelector('alter')?.textContent || '0');

  let name = step;
  if (alter === 1) name += '#';
  if (alter === -1) name += 'b';
  name += octave;

  return { name, midi: pitchToMidi(step, octave, alter) };
}

// ============================================================
// 智能难度分级算法
// ============================================================

// A池难度：根据音高在五线谱上的位置和是否含升降号
function calcNoteDifficulty(step: string, octave: number, alter: number): number {
  let diff = 1;

  // 基础：中央C附近的白键最简单 (C4-B4 = L1-2)
  // 高八度/低八度逐级增加难度
  const distFromMiddle = Math.abs(octave - 4);
  diff += distFromMiddle; // 每远离一个八度 +1

  // 五线谱线间位置：线上的音 (E4, G4, B4, D5, F5) 比间上的容易辨认
  // 加线音符更难 (C4以下, A5以上)
  const midi = pitchToMidi(step, octave, alter);
  if (midi < 60 || midi > 81) { // 低于C4或高于A5 → 加线区域
    diff += 1;
  }
  if (midi < 55 || midi > 86) { // 更极端的加线
    diff += 1;
  }

  // 升降号加难度
  if (alter !== 0) {
    diff += 2; // 有升降号 +2
  }

  // 不太常见的音名 (B, F 容易和 C, E 混淆)
  if (step === 'B' || step === 'F') {
    diff += 1;
  }

  return Math.max(1, Math.min(10, diff));
}

// B池难度：根据符号的常见程度
function calcSymbolDifficulty(symbol: string): number {
  const common: Record<string, number> = {
    'f': 1, 'p': 1, 'mf': 1, 'mp': 1,           // 基础力度
    'ff': 2, 'pp': 2,                              // 进阶力度
    'fff': 3, 'ppp': 3, 'sfz': 3, 'fp': 3,        // 高级力度
    'staccato': 2, 'accent': 2, 'tenuto': 2,       // 基础发音法
    'staccatissimo': 4, 'marcato': 4,              // 进阶发音法
    'fermata': 3,                                   // 延长记号
    'trill': 5, 'mordent': 6, 'turn': 6,           // 装饰音
  };
  return common[symbol] || 3;
}

export class EngineExtractor {

  // 主入口：传入 XML 字符串，返回四维分类好的切片池
  public static extractAll(xmlString: string): ExtractedSlice[] {
    const parser = new MusicXMLParser(xmlString);
    const slices: ExtractedSlice[] = [];

    // 执行四个维度的提取
    slices.push(...this.extractPoolA(parser));
    slices.push(...this.extractPoolB(parser));
    slices.push(...this.extractPoolC(parser));
    slices.push(...this.extractPoolD(parser));

    return slices;
  }

  // ============================================================
  // A: 单音池（提取所有独立音高）
  // ============================================================
  private static extractPoolA(parser: MusicXMLParser): ExtractedSlice[] {
    const slices: ExtractedSlice[] = [];
    const notes = parser.getNotes();

    notes.forEach((note, index) => {
      const pitchNode = note.querySelector('pitch');
      if (pitchNode) {
        const step = pitchNode.querySelector('step')?.textContent || 'C';
        const octave = parseInt(pitchNode.querySelector('octave')?.textContent || '4');
        const alter = parseInt(pitchNode.querySelector('alter')?.textContent || '0');
        const pitch = parsePitch(note);
        if (pitch) {
          slices.push({
            id: `A_note_${index}_${pitch.name}`,
            type: 'A',
            content: { pitch: pitch.name, raw: pitch.name },
            difficulty: calcNoteDifficulty(step, octave, alter)
          });
        }
      }
    });

    if (slices.length === 0) {
      slices.push(
        { id: 'A_mock_C4', type: 'A', content: { pitch: 'C4', raw: 'C4' }, difficulty: 1 },
        { id: 'A_mock_G4', type: 'A', content: { pitch: 'G4', raw: 'G4' }, difficulty: 2 },
        { id: 'A_mock_D5', type: 'A', content: { pitch: 'D5', raw: 'D5' }, difficulty: 3 }
      );
    }
    return slices;
  }

  // ============================================================
  // B: 符号池（提取 f/p、连跳音、谱号等）
  // ============================================================
  private static extractPoolB(parser: MusicXMLParser): ExtractedSlice[] {
    const slices: ExtractedSlice[] = [];
    const directions = parser.getDirections();

    // 提取力度记号 (dynamics)
    directions.forEach((dir, idx) => {
      const dynamicsEl = dir.querySelector('dynamics');
      if (dynamicsEl) {
        const child = dynamicsEl.children[0];
        if (child) {
          const symbol = child.tagName; // e.g. "ff", "pp", "mf"
          slices.push({
            id: `B_dyn_${idx}_${symbol}`,
            type: 'B',
            content: { symbol, raw: symbol },
            difficulty: calcSymbolDifficulty(symbol)
          });
        }
      }
    });

    // 提取发音法 (articulations)
    const notes = parser.getNotes();
    notes.forEach((note, idx) => {
      const articulationsEl = note.querySelector('articulations');
      if (articulationsEl) {
        Array.from(articulationsEl.children).forEach(art => {
          slices.push({
            id: `B_art_${idx}_${art.tagName}`,
            type: 'B',
            content: { symbol: art.tagName, raw: art.tagName },
            difficulty: calcSymbolDifficulty(art.tagName)
          });
        });
      }
      // 提取延音 (fermata)
      const fermata = note.querySelector('fermata');
      if (fermata) {
        slices.push({
          id: `B_fermata_${idx}`,
          type: 'B',
          content: { symbol: 'fermata', raw: 'fermata' },
          difficulty: calcSymbolDifficulty('fermata')
        });
      }
    });

    if (slices.length === 0) {
      slices.push(
        { id: 'B_mock_ff', type: 'B', content: { symbol: 'ff', raw: 'ff' }, difficulty: 1 },
        { id: 'B_mock_staccato', type: 'B', content: { symbol: 'staccato', raw: 'staccato' }, difficulty: 2 },
        { id: 'B_mock_fermata', type: 'B', content: { symbol: 'fermata', raw: 'fermata' }, difficulty: 3 }
      );
    }
    return slices;
  }

  // ============================================================
  // C: 乐理池（真正提取：音程跨度、和弦、调号）
  // ============================================================
  private static extractPoolC(parser: MusicXMLParser): ExtractedSlice[] {
    const slices: ExtractedSlice[] = [];
    const notes = parser.getNotes();

    // --- 1. 提取所有相邻音符之间的音程 ---
    const pitches: { name: string; midi: number }[] = [];
    notes.forEach(note => {
      // 跳过和弦附属音 (chord tag) 和休止符 (rest tag)
      if (note.querySelector('rest')) return;
      const pitch = parsePitch(note);
      if (pitch) pitches.push(pitch);
    });

    for (let i = 0; i < pitches.length - 1; i++) {
      const interval = Math.abs(pitches[i + 1].midi - pitches[i].midi);
      if (interval > 0 && interval <= 12) {
        const intervalName = INTERVAL_NAMES[interval] || `${interval}半音`;
        const display = `${pitches[i].name} → ${pitches[i + 1].name} (${intervalName})`;
        slices.push({
          id: `C_interval_${i}_${interval}`,
          type: 'C',
          content: {
            theory: intervalName,
            raw: display,
            notes: [pitches[i].name, pitches[i + 1].name],
            semitones: interval
          },
          difficulty: Math.min(10, Math.max(1, Math.ceil(interval / 2)))
        });
      }
    }

    // --- 2. 提取和弦 (同时发声的音符组) ---
    let chordGroup: { name: string; midi: number }[] = [];
    notes.forEach((note, idx) => {
      if (note.querySelector('rest')) return;
      const pitch = parsePitch(note);
      if (!pitch) return;

      const isChordNote = note.querySelector('chord') !== null;
      if (isChordNote) {
        chordGroup.push(pitch);
      } else {
        // 前一个和弦组结束，分析它
        if (chordGroup.length >= 2) {
          const sorted = [...chordGroup].sort((a, b) => a.midi - b.midi);
          const chordDisplay = sorted.map(p => p.name).join(' + ');
          slices.push({
            id: `C_chord_${idx}_${chordDisplay}`,
            type: 'C',
            content: {
              theory: `和弦: ${chordDisplay}`,
              raw: chordDisplay,
              notes: sorted.map(p => p.name)
            },
            difficulty: Math.min(10, chordGroup.length + 2)
          });
        }
        chordGroup = [pitch]; // 开始新的一组
      }
    });
    // 处理最后一组
    if (chordGroup.length >= 2) {
      const sorted = [...chordGroup].sort((a, b) => a.midi - b.midi);
      const chordDisplay = sorted.map(p => p.name).join(' + ');
      slices.push({
        id: `C_chord_last_${chordDisplay}`,
        type: 'C',
        content: {
          theory: `和弦: ${chordDisplay}`,
          raw: chordDisplay,
          notes: sorted.map(p => p.name)
        },
        difficulty: Math.min(10, chordGroup.length + 2)
      });
    }

    // --- 3. 提取调号 ---
    const attributes = parser.getAttributes();
    attributes.forEach((attr, idx) => {
      const fifths = attr.querySelector('key > fifths')?.textContent;
      if (fifths !== null && fifths !== undefined) {
        const keyNames: Record<string, string> = {
          '-7': 'Cb大调', '-6': 'Gb大调', '-5': 'Db大调', '-4': 'Ab大调',
          '-3': 'Eb大调', '-2': 'Bb大调', '-1': 'F大调', '0': 'C大调',
          '1': 'G大调', '2': 'D大调', '3': 'A大调', '4': 'E大调',
          '5': 'B大调', '6': 'F#大调', '7': 'C#大调'
        };
        const keyName = keyNames[fifths || '0'] || `调号(${fifths})`;
        slices.push({
          id: `C_key_${idx}_${fifths}`,
          type: 'C',
          content: { theory: keyName, raw: keyName },
          difficulty: Math.abs(parseInt(fifths || '0')) + 1
        });
      }
    });

    if (slices.length === 0) {
      slices.push(
        { id: 'C_mock_CMaj', type: 'C', content: { theory: 'C Major Chord', raw: 'C Major Chord', notes: ['C4', 'E4', 'G4'] }, difficulty: 4 },
        { id: 'C_mock_P5', type: 'C', content: { theory: '纯五度 (P5)', raw: '纯五度 (P5)', notes: ['C4', 'G4'] }, difficulty: 3 }
      );
    }
    return slices;
  }

  // ============================================================
  // D: 音型池（真正提取：音阶跑动、琶音、重复音型）
  // ============================================================
  private static extractPoolD(parser: MusicXMLParser): ExtractedSlice[] {
    const slices: ExtractedSlice[] = [];
    const notes = parser.getNotes();

    // 构建音高序列 (跳过休止和和弦附属音)
    const pitches: { name: string; midi: number }[] = [];
    notes.forEach(note => {
      if (note.querySelector('rest')) return;
      if (note.querySelector('chord')) return;
      const pitch = parsePitch(note);
      if (pitch) pitches.push(pitch);
    });

    if (pitches.length < 4) {
      slices.push(
        { id: 'D_mock_alberti', type: 'D', content: { pattern: 'Alberti Bass (C-G-E-G)', raw: 'Alberti Bass (C-G-E-G)' }, difficulty: 6 },
        { id: 'D_mock_scale', type: 'D', content: { pattern: 'C Major Scale Run', raw: 'C Major Scale Run' }, difficulty: 7 }
      );
      return slices;
    }

    // --- 1. 检测音阶跑动 (连续 4+ 个二度级进) ---
    let scaleStart = 0;
    for (let i = 1; i < pitches.length; i++) {
      const interval = Math.abs(pitches[i].midi - pitches[i - 1].midi);
      const isStep = interval === 1 || interval === 2; // 半音或全音
      if (!isStep || i === pitches.length - 1) {
        const len = i - scaleStart;
        if (len >= 4) {
          const direction = pitches[scaleStart + 1].midi > pitches[scaleStart].midi ? '上行' : '下行';
          const fragment = pitches.slice(scaleStart, scaleStart + len).map(p => p.name).join('-');
          slices.push({
            id: `D_scale_${scaleStart}_${len}`,
            type: 'D',
            content: {
              pattern: `${direction}音阶跑动 (${len}音)`,
              raw: `${direction}音阶: ${fragment}`,
              notes: pitches.slice(scaleStart, scaleStart + len).map(p => p.name)
            },
            difficulty: Math.min(10, Math.max(3, Math.ceil(len / 2) + 2))
          });
        }
        scaleStart = i;
      }
    }

    // --- 2. 检测琶音/分解和弦 (连续 3+ 个三度或以上跳进) ---
    let arpStart = 0;
    for (let i = 1; i < pitches.length; i++) {
      const interval = Math.abs(pitches[i].midi - pitches[i - 1].midi);
      const isLeap = interval >= 3 && interval <= 5; // 小三度 ~ 大三度
      if (!isLeap || i === pitches.length - 1) {
        const len = i - arpStart;
        if (len >= 3) {
          const fragment = pitches.slice(arpStart, arpStart + len).map(p => p.name).join('-');
          slices.push({
            id: `D_arp_${arpStart}_${len}`,
            type: 'D',
            content: {
              pattern: `分解和弦 (${len}音)`,
              raw: `琶音: ${fragment}`,
              notes: pitches.slice(arpStart, arpStart + len).map(p => p.name)
            },
            difficulty: Math.min(10, Math.max(4, len + 3))
          });
        }
        arpStart = i;
      }
    }

    if (slices.length === 0) {
      slices.push(
        { id: 'D_mock_alberti', type: 'D', content: { pattern: 'Alberti Bass (C-G-E-G)', raw: 'Alberti Bass (C-G-E-G)' }, difficulty: 6 },
        { id: 'D_mock_scale', type: 'D', content: { pattern: 'C Major Scale Run', raw: 'C Major Scale Run' }, difficulty: 7 }
      );
    }
    return slices;
  }
}
