import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, StaveConnector, Stem } from 'vexflow';
import { useAppStore, type Slice } from '../../core/store/useAppStore';
import { useAuth } from '../../core/auth/AuthProvider';
import { FREE_TRIAL_LIMIT } from './constants';
import { mapKeyToNote, isSharpKey, isFlatKey, parseNoteKeys } from './keyboardInput';
import FullPianoKeyboard from '../../components/FullPianoKeyboard';
import NotesInputModeToggle from '../../components/NotesInputModeToggle';
import { useNotesInputMode } from '../../hooks/useNotesInputMode';
import GuidanceModal from '../../components/GuidanceModal';
import ReviewPanel from '../../components/ReviewPanel';
import { audioEngine } from '../../core/engine/AudioEngine';
import { getClefForPitches, resolvePlacement, pitchEqual, pitchForAnswerLetter } from '../../core/engine/pitchUtils';
import { playIntervalPairAudio, playSequentialNotes, STAGGER_DELAY_MS, WRONG_FEEDBACK_RESET_MS } from '../../core/engine/intervalAudio';
import { useBlinkTimer } from '../../hooks/useBlinkTimer';
import { useOptionsFontSize } from '../../hooks/useOptionsFontSize';
import { extractNoteAnswer } from './noteAnswer';
import { interactiveAOptions } from './noteOptions';
import { getAllChordNames } from '../../core/engine/chordAnalyzer';

// ============================================================
// 辅助函数：将音高字符串 (如 C#5) 转换为 VexFlow 的 key 和 accidental
// ============================================================
function parsePitchForVexflow(pitchStr: string): { key: string; accidental: string | null } {
  const match = pitchStr.match(/^([A-Ga-g])(#|b)?(\d)$/);
  if (!match) return { key: 'c/4', accidental: null };
  return {
    key: `${match[1].toLowerCase()}/${match[3]}`,
    accidental: match[2] || null
  };
}

// 自然音级步数：用于比较音符在五线谱上的高低位置
const NOTE_STEP: Record<string, number> = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6 };

function getDiatonicStep(key: string): number {
  const [, note, octave] = key.match(/^([a-g])\/(\d)$/) || [];
  if (!note || !octave) return 0;
  return NOTE_STEP[note] + parseInt(octave) * 7;
}

/** 根据符头与第三线（中线）的位置关系决定符干方向。
 *  符头在中线以上 → 朝下；在中线以下 → 朝上；
 *  刚好在中线 → 参考第二个音；第二个音符方向遵从第一个音符。 */
function resolveStemDirection(keyA: string, keyB: string, clef: string): number {
  const middleNote = clef === 'bass' ? 'd' : 'b';
  const middleOctave = clef === 'bass' ? 3 : 4;
  const middleStep = NOTE_STEP[middleNote] + middleOctave * 7;

  const stepA = getDiatonicStep(keyA);
  const stepB = getDiatonicStep(keyB);

  if (stepA > middleStep) return Stem.DOWN;
  if (stepA < middleStep) return Stem.UP;
  // noteA 刚好在中线，参考 noteB
  if (stepB > middleStep) return Stem.DOWN;
  if (stepB < middleStep) return Stem.UP;
  return Stem.DOWN; // 两个都在中线，默认朝下
}

// ============================================================
// 选项生成器 (为每个类型生成正确答案 + 3 个干扰项)
// ============================================================

const ALL_INTERVALS = [
  '纯一度 (P1)', '小二度 (m2)', '大二度 (M2)', '小三度 (m3)', '大三度 (M3)',
  '纯四度 (P4)', '增四度 (A4)', '减五度 (d5)', '纯五度 (P5)',
  '小六度 (m6)', '大六度 (M6)', '小七度 (m7)', '大七度 (M7)', '纯八度 (P8)'
];

// 符号简称 → 含义标签映射
// 选项只显示「含义」，不含缩写前缀，防止题目中的缩写直接暗示答案
const SYMBOL_MAP: Record<string, string> = {
  'pp':       '极弱 (pianissimo)',
  'p':        '弱 (piano)',
  'mp':       '中弱 (mezzo-piano)',
  'mf':       '中强 (mezzo-forte)',
  'f':        '强 (forte)',
  'ff':       '极强 (fortissimo)',
  'fff':      '最强 (fortississimo)',
  'staccato': '断音 (staccato)',
  'accent':   '重音 (accent >)',
  'tenuto':   '保持音 (tenuto —)',
  'fermata':  '延音记号 (fermata 𝄐)',
  'sfz':      '突强 (sforzando)',
  'fp':       '强后立弱 (forte-piano)',
  'marcato':  '顿音 (marcato ^)',
  'trill':    '颤音 (trill tr)',
};

const ALL_SYMBOLS = Object.values(SYMBOL_MAP);

const ALL_PATTERNS = [
  '上行音阶跑动', '下行音阶跑动', '分解和弦', '琶音上行',
  '琶音下行', 'Alberti Bass', '重复音型', '八度跳进'
];

// 音型名称 → 预置示例音符（当 raw 字符串中无法解析出音符时作为兜底）
const PATTERN_DEFAULT_NOTES: Record<string, string[]> = {
  '上行音阶跑动': ['C4', 'D4', 'E4', 'F4', 'G4', 'A4'],
  '下行音阶跑动': ['A4', 'G4', 'F4', 'E4', 'D4', 'C4'],
  '分解和弦':    ['C4', 'E4', 'G4', 'C5'],
  '琶音上行':    ['C4', 'E4', 'G4', 'C5'],
  '琶音下行':    ['C5', 'G4', 'E4', 'C4'],
  'Alberti Bass': ['C4', 'G4', 'E4', 'G4'],
  '重复音型':    ['G4', 'G4', 'G4', 'G4'],
  '八度跳进':    ['C4', 'C5', 'C4', 'C5'],
};

// 确定性打乱函数（基于种子）
function shuffleWithSeed(array: string[], seed: number): string[] {
  const arr = [...array];
  let currentSeed = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    const j = Math.floor((currentSeed / 233280) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateOptions(slice: Slice): string[] {
  const content = slice.content as unknown as Record<string, unknown>;

  // 教师指定选项时直接使用（保留教师配置的顺序）
  const fixedOptions = content.options as string[] | undefined;
  if (fixedOptions && fixedOptions.length >= 2) {
    return [...fixedOptions];
  }

  let correct = '';
  let pool: string[] = [];

  switch (slice.module) {
    case 'notes':
      return interactiveAOptions(extractNoteAnswer((content.pitch as string) || ''));
    case 'symbols': {
      const answer = content.answer as string | undefined;
      if (answer) {
        correct = answer;
        pool = ALL_SYMBOLS;
        break;
      }
      const rawSymbol = (content.raw as string) || (content.symbol as string) || '';
      correct = SYMBOL_MAP[rawSymbol] || rawSymbol;
      pool = ALL_SYMBOLS;
      break;
    }
    case 'theory': {
      correct = (content.theory as string) || (content.raw as string) || '';
      pool = correct.includes('度') || correct.includes('P') || correct.includes('m')
        ? ALL_INTERVALS
        : ['C大调', 'G大调', 'D大调', 'F大调', 'Bb大调', 'A大调', 'Eb大调', 'E大调',
           'C Major Chord', 'G Major Chord', 'D Minor Chord', 'F Major Chord',
           'Am Chord', 'Em Chord', 'Dm Chord'];
      break;
    }
    case 'patterns': {
      const chordType = content.chordType as string | undefined;
      if (chordType === 'chord') {
        correct = (content.chordName as string) || (content.raw as string) || '';
        pool = getAllChordNames();
      } else {
        correct = (content.raw as string) || (content.pattern as string) || '';
        pool = ALL_PATTERNS;
      }
      break;
    }
  }

  if (!correct) return ['—', '—', '—', '—'];

  const distractors = pool
    .filter(p => p !== correct)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  return [correct, ...distractors].sort(() => Math.random() - 0.5);
}

/** 答对后自动切题的延时 */
const AUTO_ADVANCE_DELAY_MS = 800;

// ============================================================
// 组件
// ============================================================
export default function InteractiveQuiz() {
  const { stageId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAnonymous = !user;
  const containerRef = useRef<HTMLDivElement>(null);

  const slicesPool = useAppStore(state => state.slicesPool);
  const unlockNextStage = useAppStore(state => state.unlockNextStage);
  const completeAdventureStage = useAppStore(state => state.completeAdventureStage);
  const recordPractice = useAppStore(state => state.recordPractice);
  const getAdventureStages = useAppStore(state => state.getAdventureStages);

  // Track a session key that changes each time the component mounts (new attempt) or user retries
  const [sessionKey, setSessionKey] = useState(() => Math.random());

  // 当关卡ID变化时重置所有状态（处理"继续闯关"场景）
  useEffect(() => {
    setCurrentSliceIndex(0);
    setShowReview(false);
    setResultData(null);
    setIntroDismissed(false);
    correctCountRef.current = 0;
    wrongCountRef.current = 0;
    questStartRef.current = Date.now();
    questEndRef.current = 0;
    questionResultsRef.current = [];
    setSessionKey(Math.random());
  }, [stageId]);

  // Result modal state for pass/fail
  const [resultData, setResultData] = useState<{
    correctCount: number;
    wrongCount: number;
    accuracy: number;
    passed: boolean;
    requiredAccuracy?: number;
    timeSpentSec: number;
  } | null>(null);

  const [showGuidance, setShowGuidance] = useState(false);
  const [passOverlay, setPassOverlay] = useState(false);

  // 冒险闯关统计：跟踪正确/错误数、总用时
  const correctCountRef = useRef(0);
  const wrongCountRef = useRef(0);
  const questStartRef = useRef(Date.now());
  const questEndRef = useRef(0);

  // 每题错误次数 & 揭示正确答案
  const wrongAttemptsRef = useRef(0);
  const firstWrongAnswerRef = useRef('');
  const [revealed, setRevealed] = useState(false);

  // 题末回顾数据
  interface QuestionResult {
    slice: Slice;
    correctAnswer: string;
    userAnswer: string;
    isCorrect: boolean;
    revealed: boolean;
  }
  const questionResultsRef = useRef<QuestionResult[]>([]);
  const [showReview, setShowReview] = useState(false);

  const { stage, stageIndex } = useMemo(() => {
    // 冒险关卡检测（放在 split 逻辑之前）
    if (stageId?.startsWith('adventure_route_')) {
      const adventureStages = useAppStore.getState().getAdventureStages();
      const adventureIndex = adventureStages.findIndex(s => s.id === stageId);
      const found = adventureIndex >= 0 ? adventureStages[adventureIndex] : null;
      if (found) {
        const targetCount = found.questionCount || found.slices.length;
        const shuffle = (arr: typeof found.slices) => [...arr].sort(() => Math.random() - 0.5);
        const questions: typeof found.slices = [];
        while (questions.length < targetCount) {
          questions.push(...shuffle(found.slices));
        }
        return { stage: { ...found, slices: questions.slice(0, targetCount) }, stageIndex: adventureIndex + 1 };
      }
      return { stage: null, stageIndex: 0 };
    }

    const parts = stageId?.split('_') || [];
    // 自定义关卡 id 格式: custom_xxx；自动关卡: auto_moduleId_stage_n
    const moduleId = parts[0] === 'custom'
      ? (useAppStore.getState().customStages.find(cs => cs.id === stageId)?.module || '')
      : parts[1] || '';
    const getAllStages = useAppStore.getState().getAllStages;
    const stages = getAllStages(moduleId);
    const idx = stages.findIndex(s => s.id === stageId);
    const found = idx >= 0 ? stages[idx] : null;
    if (found) {
      const targetCount = found.questionCount || found.slices.length;
      const shuffle = (arr: typeof found.slices) => [...arr].sort(() => Math.random() - 0.5);
      const questions: typeof found.slices = [];
      while (questions.length < targetCount) {
        questions.push(...shuffle(found.slices));
      }
      return { stage: { ...found, slices: questions.slice(0, targetCount) }, stageIndex: idx + 1 };
    }
    return { stage: null, stageIndex: 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageId, slicesPool, sessionKey]);

  // ============================================================
  // 学习指导蒙层
  // ============================================================
  const customStages = useAppStore(state => state.customStages);
  const adventureStages = useAppStore(state => state.adventureStages);

  let stageRecord: { title: string; guidance?: string } | undefined;
  let guidanceImages: import('../../core/store/useAppStore').GuidanceImage[] = [];
  let guidance = '';
  if (stageId?.startsWith('adventure_route_')) {
    const advStage = adventureStages.find(s => s.id === stageId);
    if (advStage) {
      const sourceStage = customStages.find(cs => cs.id === advStage.sourceStageId);
      guidance = advStage.guidance ?? sourceStage?.guidance ?? '';
      guidanceImages = advStage.guidanceImages ?? [];
      stageRecord = { title: advStage.title || sourceStage?.title || stageId, guidance };
    }
  } else {
    const record = customStages.find(cs => cs.id === stageId);
    if (record) {
      guidance = record.guidance ?? '';
      stageRecord = { title: record.title, guidance };
    }
  }
  const [introDismissed, setIntroDismissed] = useState(() => !guidance);

  const [currentSliceIndex, setCurrentSliceIndex] = useState(0);
  const currentSliceIndexRef = useRef(currentSliceIndex);
  currentSliceIndexRef.current = currentSliceIndex;
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
  const [audioEnabled, setAudioEnabled] = useState(audioEngine.enabled);
  const [showAudioTip, setShowAudioTip] = useState(true);
  const [tipFading, setTipFading] = useState(false);
  useEffect(() => {
    setTipFading(false);
    const t1 = setTimeout(() => setTipFading(true), 3000);
    const t2 = setTimeout(() => setShowAudioTip(false), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [showAudioTip]);
  const [usePiano, setUsePiano] = useNotesInputMode();
  // Show the physical-keyboard hint only on devices that report a fine pointer + hover,
  // which excludes phones and most touch-only tablets.
  const [hasFinePointer] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches
  );
  const quizCardRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef(feedback);
  feedbackRef.current = feedback;

  // 记录每道题的开始时间，用于 practice_records 的 time_spent_ms
  const questionStartedRef = useRef(Date.now());
  useEffect(() => {
    questionStartedRef.current = Date.now();
    wrongAttemptsRef.current = 0;
    firstWrongAnswerRef.current = '';
    setRevealed(false);
  }, [currentSliceIndex]);

  const currentSlice = stage?.slices[currentSliceIndex];

  // Blink effect: show note for configured time, hide for configured time, loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const blinkResetKey = `${currentSliceIndex}_${introDismissed}`;
  const { noteVisible, resetBlink } = useBlinkTimer(
    stage?.noteDisplayMs ?? 3000,
    stage?.noteHiddenMs ?? 6000,
    blinkResetKey,
    !introDismissed,  // 引导未确认前不启动闪烁，确认后才开始计时
  );

  // 题目出现时自动播放音频（音型/模式）— 等待采样器就绪后播放
  useEffect(() => {
    if (!audioEnabled || !currentSlice) return;
    let cancelled = false;
    (async () => {
      while (!audioEngine.isReady && !cancelled) {
        await new Promise<void>(r => setTimeout(r, 100));
      }
      if (cancelled) return;
      if (currentSlice.module === 'patterns') {
        const content = currentSlice.content as unknown as Record<string, unknown>;
        const rawStr: string = (content.raw as string) || (content.pattern as string) || '';
        let patternNotes: string[] = (content.notes as string[]) || [];
        if (patternNotes.length < 2) {
          patternNotes = rawStr.match(/[A-Ga-g][#b]?\d/g) || [];
        }
        if (patternNotes.length < 2) {
          for (const [key, notes] of Object.entries(PATTERN_DEFAULT_NOTES)) {
            if (rawStr.includes(key)) { patternNotes = notes; break; }
          }
        }
        if (patternNotes.length >= 2) {
          playSequentialNotes(patternNotes);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [currentSliceIndex, audioEnabled]);

  /** 播放当前双音/音程题的音频（等待采样就绪 + Tone 预热后再播）
   *  通过 currentSliceIndexRef 检测题目是否已切换，防止回调污染下一题音频 */
  const playCurrentInterval = async () => {
    if (!currentSlice || currentSlice.module !== 'theory') return;
    const questionId = currentSliceIndexRef.current;
    while (!audioEngine.isReady) {
      await new Promise<void>(r => setTimeout(r, 100));
      if (questionId !== currentSliceIndexRef.current) return; // 题目已切换
    }
    // 预热 Tone.js AudioContext，消除首次播放的异步延迟
    await audioEngine.ensureReady();
    if (questionId !== currentSliceIndexRef.current) return; // 预热期间题目已切换
    const content = currentSlice.content as unknown as Record<string, unknown>;
    const noteA = (content.noteA as string | undefined) || (content.notes as string[] | undefined)?.[0];
    const noteB = (content.noteB as string | undefined) || (content.notes as string[] | undefined)?.[1];
    if (noteA && noteB) {
      playIntervalPairAudio(noteA, noteB);
      // 第二个音响 STAGGER_DELAY_MS 后 stop（以实际播放为基准）
      setTimeout(() => {
        if (questionId === currentSliceIndexRef.current) audioEngine.stop();
      }, STAGGER_DELAY_MS + 1000);
    }
  };

  // ============================================================
  // VexFlow 渲染 (根据题目类型绘制不同内容)
  // ============================================================
  useEffect(() => {
    if (!containerRef.current || !currentSlice) return;
    containerRef.current.innerHTML = '';

    // B 类（符号）不使用 VexFlow，用纯文字展示
    if (currentSlice.module === 'symbols') return;

    const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
    const width = Math.min(500, containerRef.current.clientWidth - 20);
    const isGrand = currentSlice.module === 'notes';

    if (isGrand) {
      // ── A 类单音：使用大谱表 ──
      renderer.resize(width, 280);
      const context = renderer.getContext();

      const staveW = width - 40;
      const staveTop = new Stave(10, 30, staveW);
      staveTop.addClef('treble');
      staveTop.setContext(context).draw();

      const staveBottom = new Stave(10, 130, staveW);
      staveBottom.addClef('bass');
      staveBottom.setContext(context).draw();

      const connector = new StaveConnector(staveTop, staveBottom);
      connector.setType(StaveConnector.type.BRACE);
      connector.setContext(context).draw();

      const pitch = (currentSlice.content as unknown as Record<string, unknown>).pitch as string || '';
      const placement = resolvePlacement(pitch, ((currentSlice.content as unknown as Record<string, unknown>).placement as 'auto' | 'treble' | 'bass') || 'auto');
      const activeStave = placement === 'treble' ? staveTop : staveBottom;

      try {
        const { key, accidental } = parsePitchForVexflow(pitch);
        const note = new StaveNote({ keys: [key], duration: 'w', clef: placement });
        if (accidental) note.addModifier(new Accidental(accidental));

        const voice = new Voice({ numBeats: 4, beatValue: 4 });
        voice.setMode(2);
        voice.addTickables([note]);
        new Formatter().joinVoices([voice]).format([voice], 350);
        voice.draw(context, activeStave);
      } catch (e) {
        console.error('VexFlow Draw Error:', e);
      }
      return;
    }

    // ── C / D 类：单五线谱 ──
    renderer.resize(width, 200);
    const context = renderer.getContext();

    // 新格式: noteA, noteB；旧格式: notes[0], notes[1]
    const content = currentSlice.content as any;
    const noteA = content.noteA || content.notes?.[0] || '';
    const noteB = content.noteB || content.notes?.[1] || '';

    let clef = 'treble';
    if (currentSlice.module === 'theory') {
      const explicitPlacement = content.placement as string | undefined;
      if (explicitPlacement === 'treble' || explicitPlacement === 'bass') {
        clef = explicitPlacement;
      } else if (noteA && noteB) {
        clef = getClefForPitches([noteA, noteB]);
      }
    }

    const stave = new Stave(10, 40, width - 40);
    stave.addClef(clef);
    stave.setContext(context).draw();

    try {
      if (currentSlice.module === 'theory') {
        // ---- C: 乐理 → 画音程(两个音)，紧凑排列 ----
        if (noteA && noteB) {
          // 同音：和不同音一样，渲染两个半音符
          if (noteA === noteB) {
            const parsedA = parsePitchForVexflow(noteA);
            const parsedB = parsePitchForVexflow(noteB);
            const stemDir = resolveStemDirection(parsedA.key, parsedB.key, clef);
            const vfNotes = [parsedA, parsedB].map(p => {
              const note = new StaveNote({ keys: [p.key], duration: 'h', clef, stemDirection: stemDir });
              if (p.accidental) note.addModifier(new Accidental(p.accidental));
              return note;
            });
            const beats = vfNotes.length * 2;
            const voice = new Voice({ numBeats: beats, beatValue: 4 });
            voice.setMode(2);
            voice.addTickables(vfNotes);
            new Formatter().joinVoices([voice]).format([voice], 160);
            voice.draw(context, stave);
          } else {
            const parsedA = parsePitchForVexflow(noteA);
            const parsedB = parsePitchForVexflow(noteB);
            const stemDir = resolveStemDirection(parsedA.key, parsedB.key, clef);
            const vfNotes = [parsedA, parsedB].map(p => {
              const note = new StaveNote({ keys: [p.key], duration: 'h', clef, stemDirection: stemDir });
              if (p.accidental) note.addModifier(new Accidental(p.accidental));
              return note;
            });
            const beats = vfNotes.length * 2;
            const voice = new Voice({ numBeats: beats, beatValue: 4 });
            voice.setMode(2);
            voice.addTickables(vfNotes);
            new Formatter().joinVoices([voice]).format([voice], 160);
            voice.draw(context, stave);
          }
        }

      } else if (currentSlice.module === 'patterns') {
        // ---- D: 音型 — 和弦识别 or 传统音型 ----
        const content = currentSlice.content as unknown as Record<string, unknown>;
        const isChord = (content.chordType as string) === 'chord';
        const displayMode = (content.displayMode as string) || 'arpeggio';

        if (isChord && displayMode === 'block') {
          // ── 和弦柱式渲染 ──
          const notes = (content.notes as string[]) || [];
          if (notes.length >= 2) {
            const vfKeys = notes.map(n => {
              const parsed = parsePitchForVexflow(n);
              return parsed.key;
            });
            const chordBlockNote = new StaveNote({ keys: vfKeys, duration: 'w', clef });
            notes.forEach((n, i) => {
              const parsed = parsePitchForVexflow(n);
              if (parsed.accidental) chordBlockNote.addModifier(new Accidental(parsed.accidental), i);
            });
            const voice = new Voice({ numBeats: 4, beatValue: 4 });
            voice.setMode(2);
            voice.addTickables([chordBlockNote]);
            new Formatter().joinVoices([voice]).format([voice], 280);
            voice.draw(context, stave);
          }
        } else {
          // ── 传统音型 / 和弦分解渲染：四分音符序列 ----
          const rawStr: string = (content.raw as string) || (content.pattern as string) || '';

          let noteNames: string[] = (content.notes as string[]) || [];
          if (noteNames.length < 2) {
            noteNames = rawStr.match(/[A-Ga-g][#b]?\d/g) || [];
          }
          if (noteNames.length < 2) {
            for (const [key, notes] of Object.entries(PATTERN_DEFAULT_NOTES)) {
              if (rawStr.includes(key)) { noteNames = notes; break; }
            }
          }
          if (noteNames.length < 2) {
            noteNames = ['C4', 'D4', 'E4', 'F4', 'G4'];
          }

          const vfNotes = noteNames.map(n => {
            const { key, accidental } = parsePitchForVexflow(n);
            const note = new StaveNote({ keys: [key], duration: 'q', clef });
            if (accidental) note.addModifier(new Accidental(accidental));
            return note;
          });

          const totalBeats = vfNotes.length;
          const voice = new Voice({ numBeats: totalBeats, beatValue: 4 });
          voice.setMode(2);
          voice.addTickables(vfNotes);
          new Formatter().joinVoices([voice]).format([voice], Math.min(360, totalBeats * 60));
          voice.draw(context, stave);
        }
      }
    } catch (e) {
      console.error("VexFlow Draw Error:", e);
    }
    // re-fire after modal dismiss so VexFlow/blink reset
  }, [currentSlice, introDismissed]);

  // Physical keyboard input for Notes (A-type) options mode.
  // Ref lets us reference the latest handleAnswer (defined further down) while keeping
  // the hook above the early return below, satisfying Rules of Hooks.
  const handleAnswerRef = useRef<(answer: string) => void>(() => {});
  const sliceModule = currentSlice?.module;
  const referencePitch = currentSlice?.module === 'notes' ? ((currentSlice.content as unknown as Record<string, unknown>).pitch as string) || 'C4' : '';
  useEffect(() => {
    if (sliceModule !== 'notes' || usePiano) return;
    // 300ms buffer so sequences like "C" + "#" resolve to a single "C#" answer.
    const WINDOW_MS = 300;
    let buffer: string[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      const answer = parseNoteKeys(buffer);
      buffer = [];
      if (!answer) return;
      void audioEngine.playNote(pitchForAnswerLetter(answer, referencePitch));
      handleAnswerRef.current(answer);
    };
    const onKeydown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const isLetter = mapKeyToNote(e.key) !== null;
      const isAccidental = isSharpKey(e.key) || isFlatKey(e.key);
      if (!isLetter && !isAccidental) return;
      e.preventDefault();
      // 反馈期间按键：即时视觉提示，告知用户输入已收到但须等待反馈结束
      if (feedbackRef.current !== 'none') {
        quizCardRef.current?.animate(
          [{ filter: 'brightness(0.92)' }, { filter: 'brightness(1)' }],
          { duration: 200, easing: 'ease-out' }
        );
        return;
      }
      buffer.push(e.key);
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, WINDOW_MS);
    };
    window.addEventListener('keydown', onKeydown);
    return () => {
      window.removeEventListener('keydown', onKeydown);
      if (timer) clearTimeout(timer);
    };
  }, [sliceModule, usePiano, referencePitch]);

  if (!stage) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px' }}>
        <p style={{ color: '#6b7280', fontSize: '1.2rem' }}>Stage not found.</p>
        <button onClick={() => navigate(-1)} style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Go Back</button>
      </div>
    );
  }

  // ============================================================
  // 选项与判题
  // ============================================================
  const options = useMemo(() => {
    if (!currentSlice) return [];
    const opts = generateOptions(currentSlice);
    const content = currentSlice.content as unknown as Record<string, unknown>;
    const fixedOptions = content.options as string[] | undefined;

    // 如果是教师配置的选项，判断是否需要打乱
    if (fixedOptions && fixedOptions.length >= 2) {
      // 获取正确答案
      let correctAnswer = '';
      switch (currentSlice.module) {
        case 'notes':
          correctAnswer = extractNoteAnswer((content.pitch as string) || '');
          break;
        case 'symbols':
          correctAnswer = (content.answer as string) || '';
          if (!correctAnswer) {
            const rawSymbol = (content.raw as string) || (content.symbol as string) || '';
            correctAnswer = SYMBOL_MAP[rawSymbol] || rawSymbol;
          }
          break;
        case 'theory':
          correctAnswer = (content.theory as string) || (content.raw as string) || '';
          break;
        case 'patterns':
          correctAnswer = (content.raw as string) || (content.pattern as string) || '';
          break;
      }

      // 如果选项中包含正确答案，保留教师配置的顺序
      if (opts.includes(correctAnswer)) {
        return opts;
      }

      // 如果选项中不包含正确答案，说明是系统补充的，使用确定性打乱
      return shuffleWithSeed(opts, sessionKey + currentSliceIndex);
    }

    return opts;
  }, [currentSlice, sessionKey, currentSliceIndex]);

  // Use a uniform font size based on the longest option text
  const optionsFontSize = useOptionsFontSize(options);

  const getCorrectAnswer = (): string => {
    if (!currentSlice) return '';
    const content = currentSlice.content as unknown as Record<string, unknown>;
    switch (currentSlice.module) {
      case 'notes': {
        const pitch = (content.pitch as string) || '';
        if (usePiano) return pitch;
        return extractNoteAnswer(pitch);
      }
      case 'symbols': {
        if (content.answer) return content.answer as string;
        const rawSymbol = (content.raw as string) || (content.symbol as string) || '';
        return SYMBOL_MAP[rawSymbol] || rawSymbol;
      }
      case 'theory':
        // 新格式优先使用 theory 字段
        return (content.theory as string) || (content.raw as string) || '';
      case 'patterns': return (content.raw as string) || (content.pattern as string) || '';
      default: return '';
    }
  };

  const handleAnswer = (answer: string) => {
    if (feedback !== 'none' || revealed || !currentSlice) return;
    resetBlink();
    const correct = getCorrectAnswer();
    const isPianoTypeA = usePiano && currentSlice.module === 'notes';
    const isCorrect = isPianoTypeA
      ? pitchEqual(answer, correct)
      : answer === correct;

    const timeSpentMs = Date.now() - questionStartedRef.current;

    // 记录答题：fire-and-forget，不阻塞反馈动画
    recordPractice({
      stageId: stage.id,
      quizId: currentSlice.id,
      module: currentSlice.module,
      isCorrect,
      answeredWrong: isCorrect ? undefined : answer,
      timeSpentMs,
    });

    if (isCorrect) {
      // 推入回顾数据：第一次就答对才算正确
      const hadPreviousWrong = wrongAttemptsRef.current > 0;
      questionResultsRef.current.push({
        slice: currentSlice,
        correctAnswer: correct,
        userAnswer: hadPreviousWrong ? firstWrongAnswerRef.current : answer,
        isCorrect: !hadPreviousWrong,
        revealed: false,
      });

      setFeedback('correct');
      correctCountRef.current += 1;  // 跟踪冒险闯关统计
      void playCurrentInterval();

      const isTheoryModule = currentSlice.module === 'theory';
      setTimeout(() => {
        if (!isTheoryModule) audioEngine.stop();
        setFeedback('none');
        if (currentSliceIndex < stage.slices.length - 1) {
          setCurrentSliceIndex(prev => prev + 1);
        } else {
          showReviewScreen();
        }
      }, AUTO_ADVANCE_DELAY_MS);
    } else {
      wrongCountRef.current += 1;  // 跟踪冒险闯关统计
      wrongAttemptsRef.current += 1;
      if (wrongAttemptsRef.current === 1) firstWrongAnswerRef.current = answer;

      if (wrongAttemptsRef.current >= 2) {
        // 第二次错：揭示正确答案
        const correctAnswer = getCorrectAnswer();
        questionResultsRef.current.push({
          slice: currentSlice,
          correctAnswer,
          userAnswer: answer,
          isCorrect: false,
          revealed: true,
        });
        setFeedback('none');
        setRevealed(true);
        void playCurrentInterval();
      } else {
        // 第一次错：红闪，可重试
        setFeedback('wrong');
        setTimeout(() => setFeedback('none'), WRONG_FEEDBACK_RESET_MS);
      }
    }
  };
  handleAnswerRef.current = handleAnswer;

  const handleRevealNext = () => {
    audioEngine.stop();
    if (!stage) return;
    if (currentSliceIndex < stage.slices.length - 1) {
      setCurrentSliceIndex(prev => prev + 1);
    } else {
      showReviewScreen();
    }
  };

  function showReviewScreen() {
    questEndRef.current = Date.now();
    // 冒险模式：答题结束后立即判断是否通过，如果通过则先显示烟花
    if (stage?.module === 'adventure') {
      const qResults = questionResultsRef.current;
      const correctQ = qResults.filter(r => r.isCorrect).length;
      const totalQ = qResults.length;
      const accuracy = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 100;
      const pc = stage.passCriteria;
      const passed = !pc?.enabled || accuracy >= pc.minAccuracy;
      const timeSec = Math.round((questEndRef.current - questStartRef.current) / 1000);

      completeAdventureStage(stage.id, {
        correctCount: correctCountRef.current,
        wrongCount: wrongCountRef.current,
        timeSpentSec: timeSec,
        passed,
        stageVersion: stage.stageVersion,
      });

      if (passed) {
        // 通过：先显示烟花庆祝，然后显示回顾界面
        setPassOverlay(true);
        setTimeout(() => {
          setPassOverlay(false);
          setShowReview(true);
        }, 1200);
        return;
      }
    }
    // 未通过或非冒险模式：显示回顾界面
    setShowReview(true);
  }

  const handleRetry = () => {
    setResultData(null);
    setShowReview(false);
    setCurrentSliceIndex(0);
    correctCountRef.current = 0;
    wrongCountRef.current = 0;
    questStartRef.current = Date.now();
    questEndRef.current = 0;
    questionResultsRef.current = [];
    setSessionKey(Math.random());
  };

  function finishQuiz() {
    if (!stage) return;
    setShowReview(false);
    if (stage.module === 'adventure') {
      // 冒险模式：直接返回地图（通关判断和烟花已在 showReviewScreen 中处理）
      navigate('/client/adventure');
    } else {
      // 普通模式：解锁下一关
      unlockNextStage(stage.module, stageIndex);
      navigate(-1);
      setTimeout(() => alert('🎉 Stage Cleared!'), 100);
    }
  }

  const handleBackToMap = () => navigate('/client/adventure');

  const handleContinueAdventure = (nextStageId: string) => {
    navigate(`/client/quiz/${nextStageId}`, { replace: true });
  };

  const progressPercent = ((currentSliceIndex) / stage.slices.length) * 100;

  // B 类的题目用纯文字大卡片展示（不用 VexFlow）
  const isSymbolType = currentSlice?.module === 'symbols';

  // ── 题末回顾 ──
  if (showReview) {
    const results = questionResultsRef.current;
    const sortedResults = [...results].sort((a, b) => {
      if (a.isCorrect === b.isCorrect) return 0;
      return a.isCorrect ? 1 : -1;
    });
    const correctCount = results.filter(r => r.isCorrect).length;
    const wrongCount2 = results.length - correctCount;
    const revealedCount = results.filter(r => r.revealed).length;
    const reviewTimeSec = Math.round(((questEndRef.current || Date.now()) - questStartRef.current) / 1000);
    const correctQ = results.filter(r => r.isCorrect).length;
    const reviewAccuracy = results.length > 0 ? Math.round((correctQ / results.length) * 100) : 100;
    const reviewPc = stage?.passCriteria;
    const reviewPassed = !reviewPc?.enabled || reviewAccuracy >= reviewPc.minAccuracy;

    let nextStage: typeof stage | null = null;
    if (stage?.module === 'adventure' && reviewPassed) {
      const allAdventureStages = getAdventureStages();
      const currentIdx = allAdventureStages.findIndex(s => s.id === stage.id);
      if (currentIdx >= 0 && currentIdx < allAdventureStages.length - 1) {
        const nextIdx = currentIdx + 1;
        // Anonymous users cannot continue beyond the free trial limit
        if (!(isAnonymous && nextIdx >= FREE_TRIAL_LIMIT)) {
          nextStage = allAdventureStages[nextIdx];
        }
      }
    }

    return (
      <ReviewPanel
        stageId={stageId!}
        stage={stage}
        sortedResults={sortedResults}
        correctCount={correctCount}
        wrongCount={wrongCount2}
        revealedCount={revealedCount}
        timeSpentSec={reviewTimeSec}
        accuracy={reviewAccuracy}
        passed={reviewPassed}
        nextStageId={nextStage?.id}
        stageTitle={stageRecord?.title || stage?.title || ''}
        guidance={guidance}
        guidanceImages={guidanceImages}
        onRetry={handleRetry}
        onContinueAdventure={handleContinueAdventure}
        onFinishQuiz={finishQuiz}
      />
    );
  }

  // ── 通关成功过渡遮罩 ──
  if (passOverlay) {
    const confettiColors = ['#f59e0b','#ef4444','#3b82f6','#10b981','#8b5cf6','#ec4899','#06b6d4','#f97316'];
    const confetti = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      duration: 0.8 + Math.random() * 0.8,
      color: confettiColors[i % confettiColors.length],
      size: 6 + Math.random() * 6,
      shape: Math.random() > 0.5 ? '50%' : '2px',
      drift: (Math.random() - 0.5) * 80,
    }));

    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'linear-gradient(180deg, #fefce8 0%, #ffffff 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        flexDirection: 'column', gap: '12px', overflow: 'hidden',
      }}>
        <style>{`
          @keyframes confetti-fall {
            0%   { transform: translateY(0) translateX(0) rotate(0deg); opacity: 1; }
            100% { transform: translateY(-110vh) translateX(var(--drift)) rotate(720deg); opacity: 0; }
          }
          @keyframes celebrate-pop {
            0%   { transform: scale(0.3); opacity: 0; }
            50%  { transform: scale(1.15); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes sparkle-twinkle {
            0%, 100% { transform: scale(0) rotate(0deg); opacity: 0; }
            50%      { transform: scale(1) rotate(180deg); opacity: 1; }
          }
        `}</style>
        {confetti.map(c => (
          <div key={c.id} style={{
            position: 'absolute', top: '100%', left: `${c.left}%`,
            width: c.size, height: c.size, borderRadius: c.shape,
            background: c.color, opacity: 0,
            animation: `confetti-fall ${c.duration}s ease-out ${c.delay}s forwards`,
            '--drift': `${c.drift}px`,
          } as React.CSSProperties} />
        ))}
        {/* 中心内容 */}
        <div style={{
          animation: 'celebrate-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.1s both',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
        }}>
          <div style={{ fontSize: '4.5rem', lineHeight: 1 }}>🎉</div>
          <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, background: 'linear-gradient(135deg, #059669, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            通关成功！
          </h2>
        </div>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8', animation: 'celebrate-pop 0.4s ease-out 0.3s both' }}>
          正在返回闯关地图...
        </p>
      </div>
    );
  }

  // ── 通关结算弹框 ──
  if (resultData) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
        <div style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: '440px', padding: '32px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>😅</div>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.3rem', fontWeight: 700, color: '#1f2937' }}>
            差一点就过关了！
          </h2>
          <p style={{ margin: '0 0 24px', fontSize: '0.9rem', color: '#6b7280' }}>
            {stage.title}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: '#f9fafb', borderRadius: '12px', fontSize: '0.9rem' }}>
              <span style={{ color: '#6b7280' }}>正确率</span>
              <span style={{ fontWeight: 700, color: '#dc2626' }}>{resultData.accuracy}% {resultData.requiredAccuracy != null && <span style={{ fontWeight: 400, color: '#9ca3af' }}>/ 要求 ≥{resultData.requiredAccuracy}%</span>}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: '#f9fafb', borderRadius: '12px', fontSize: '0.9rem' }}>
              <span style={{ color: '#6b7280' }}>答对/答错</span>
              <span style={{ fontWeight: 700, color: '#374151' }}>{resultData.correctCount}/{resultData.wrongCount}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: '#f9fafb', borderRadius: '12px', fontSize: '0.9rem' }}>
              <span style={{ color: '#6b7280' }}>用时</span>
              <span style={{ fontWeight: 700, color: '#374151' }}>{Math.floor(resultData.timeSpentSec / 60)}分{resultData.timeSpentSec % 60}秒</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={handleRetry}
              style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', background: '#f59e0b', color: 'white', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}
            >
              再来一次
            </button>
            {guidance && (
              <button
                onClick={() => setShowGuidance(true)}
                style={{ padding: '12px 24px', borderRadius: '12px', border: '1px solid #d1d5db', background: 'white', color: '#6b7280', fontWeight: 600, cursor: 'pointer' }}
              >
                查看学习指导
              </button>
            )}
            <button
              onClick={handleBackToMap}
              style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', background: 'transparent', color: '#9ca3af', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}
            >
              返回闯关地图
            </button>
          </div>

          {/* 学习指导蒙层（在结算弹框之上） */}
          {showGuidance && guidance && (
            <GuidanceModal
              title={stageRecord?.title || stage.title}
              guidance={guidance}
              guidanceImages={guidanceImages}
              onStart={() => setShowGuidance(false)}
            />
          )}
        </div>
      </div>
    );
  }

  if (!introDismissed && guidance && stageRecord) {
    return (
      <GuidanceModal
        title={stageRecord.title}
        guidance={guidance}
        guidanceImages={guidanceImages}
        onStart={() => setIntroDismissed(true)}
      />
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', transition: 'background 0.5s ease',
      background: feedback === 'correct' ? '#ecfdf5' : feedback === 'wrong' ? '#fef2f2' : 'transparent'
    }}>
      <header className="quiz-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <button
          onClick={() => {
            if (stage?.module === 'adventure') {
              navigate('/client/adventure');
            } else {
              navigate(-1);
            }
          }}
          style={{ background: 'white', border: '1px solid #e5e7eb', padding: '8px 16px', borderRadius: '20px', fontSize: '1rem', cursor: 'pointer', color: '#6b7280', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
        >
          Quit
        </button>
        <h2 style={{ margin: 0, color: '#111827', fontSize: '1.5rem', fontWeight: '800', letterSpacing: '-0.5px' }}>
          {stage.title} <span style={{ color: '#9ca3af', fontWeight: '500', marginLeft: '10px' }}>{currentSliceIndex + 1} / {stage.slices.length}</span>
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {currentSlice?.module === 'notes' && (
            <NotesInputModeToggle usePiano={usePiano} onChange={setUsePiano} />
          )}
          <div style={{ width: '150px', height: '8px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${progressPercent}%`, height: '100%', background: '#3b82f6', borderRadius: '4px', transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}></div>
          </div>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { audioEngine.setEnabled(!audioEngine.enabled); if (audioEngine.enabled) void audioEngine.prime(); setAudioEnabled(audioEngine.enabled); setShowAudioTip(true); }}
              title={audioEnabled ? '关闭音效' : '开启音效'}
              style={{ background: audioEnabled ? '#eff6ff' : 'white', border: `1px solid ${audioEnabled ? '#bfdbfe' : '#e5e7eb'}`, borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', transition: 'all 0.2s ease', color: audioEnabled ? '#3b82f6' : '#9ca3af' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
              onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.93)'; }}
              onMouseUp={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
            >
              {audioEnabled ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <line x1="23" y1="9" x2="17" y2="15"/>
                  <line x1="17" y1="9" x2="23" y2="15"/>
                </svg>
              )}
            </button>
            {showAudioTip && (
              <div style={{ position: 'absolute', right: 0, top: '44px', background: '#1f2937', color: 'white', borderRadius: '10px', padding: '8px 12px', fontSize: '0.8rem', whiteSpace: 'nowrap', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', opacity: tipFading ? 0 : 1, transition: 'opacity 0.5s ease' }}>
                {audioEnabled ? '音效已开启，答题时会播放音符声音' : '音效已关闭'}
                <div style={{ position: 'absolute', top: '-5px', right: '12px', width: '10px', height: '10px', background: '#1f2937', transform: 'rotate(45deg)' }} />
              </div>
            )}
          </div>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {/* 题目展示区 */}
        <div
          ref={quizCardRef}
          className="quiz-card"
          style={{
            background: 'white',
            borderRadius: '32px',
            boxShadow: feedback === 'correct' ? '0 20px 40px rgba(16,185,129,0.15)' : feedback === 'wrong' ? '0 20px 40px rgba(239,68,68,0.15)' : '0 10px 40px rgba(0,0,0,0.04)',
            padding: '40px',
            marginBottom: '60px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '500px',
            minHeight: '180px',
            transform: feedback === 'wrong' ? 'translateX(10px)' : 'none',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            border: '1px solid #f9fafb'
          }}
        >
          {isSymbolType ? (
            // B 类：显示符号简称（读单词），不显示括号里的详细解释
            <div style={{ textAlign: 'center', opacity: noteVisible ? 1 : 0, transition: 'opacity 0.3s ease' }}>
              <div style={{ fontSize: '4rem', fontWeight: '800', color: '#1f2937', marginBottom: '10px', fontStyle: 'italic', fontFamily: 'serif' }}>
                {String((currentSlice?.content as unknown as Record<string, unknown>).symbol || (currentSlice?.content as unknown as Record<string, unknown>).raw || '?')}
              </div>
              <div style={{ fontSize: '1rem', color: '#9ca3af' }}>这是什么音乐记号？</div>
            </div>
          ) : (
            // A/C/D 类：用 VexFlow 渲染乐谱
            <div ref={containerRef} id="vexflow-container" style={{ opacity: noteVisible ? 1 : 0, transition: 'opacity 0.3s ease' }}></div>
          )}
        </div>

        {/* 选项区 */}
        {currentSlice?.module === 'notes' && usePiano ? (
          <FullPianoKeyboard onAnswer={handleAnswer} feedback={feedback} referencePitch={referencePitch} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            {currentSlice?.module === 'notes' && hasFinePointer && (
              <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                提示: 按键盘 <strong style={{ color: '#6b7280' }}>C D E F G A B</strong> 也可作答
              </div>
            )}
          <div className="quiz-options" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '700px' }}>
            {options.map((opt, i) => {
              const currentCorrect = revealed ? getCorrectAnswer() : '';
              const isCorrectOption = revealed && opt === currentCorrect;
              const isWrongPick = revealed && opt !== currentCorrect;
              return (
              <button
                key={`${currentSliceIndex}_${i}_${opt}`}
                onClick={() => {
                  if (revealed) return;
                  if (audioEnabled && currentSlice) {
                    if (currentSlice.module === 'notes') {
                      void audioEngine.playNote(pitchForAnswerLetter(opt, referencePitch));
                    }
                  }
                  handleAnswer(opt);
                }}
                style={{
                  minWidth: '140px',
                  maxWidth: '260px',
                  padding: '14px 20px',
                  borderRadius: '20px',
                  border: isCorrectOption ? '2px solid #10b981' : isWrongPick ? '2px solid #e5e7eb' : '1px solid #f3f4f6',
                  background: isCorrectOption ? '#ecfdf5' : isWrongPick ? '#f9fafb' : 'white',
                  fontSize: optionsFontSize,
                  fontWeight: '700',
                  color: isCorrectOption ? '#059669' : isWrongPick ? '#d1d5db' : '#374151',
                  cursor: revealed ? 'default' : 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isCorrectOption ? '0 0 0 3px rgba(16,185,129,0.15)' : '0 4px 15px rgba(0,0,0,0.03)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: '1.4',
                  textAlign: 'center'
                }}
                onMouseEnter={e => {
                  if (revealed) return;
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 12px 20px rgba(0,0,0,0.06)';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
                onMouseDown={e => {
                  if (revealed) return;
                  if (audioEnabled) void audioEngine.prime();
                  e.currentTarget.style.transform = 'translateY(2px) scale(0.96)';
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.color = '#3b82f6';
                }}
                onMouseUp={e => {
                  if (revealed) return;
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.color = '#374151';
                }}
                onMouseLeave={e => {
                  if (revealed) return;
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.color = '#374151';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.03)';
                  e.currentTarget.style.borderColor = '#f3f4f6';
                }}
              >
                {opt}
              </button>
            );
          })}
          </div>
          {revealed && (
            <button onClick={handleRevealNext} style={{
              marginTop: '24px', padding: '10px 28px', borderRadius: '12px',
              border: 'none', background: '#3b82f6', color: 'white', fontWeight: 700,
              fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
            }}>
              下一题 →
            </button>
          )}
          </div>
        )}
      </div>
    </div>
  );
}
