import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, StaveConnector, Stem } from 'vexflow';
import { useAppStore, type Slice } from '../../core/store/useAppStore';
import { mapKeyToNote, isSharpKey, isFlatKey, parseNoteKeys } from './keyboardInput';
import FullPianoKeyboard from '../../components/FullPianoKeyboard';
import NotesInputModeToggle from '../../components/NotesInputModeToggle';
import { useNotesInputMode } from '../../hooks/useNotesInputMode';
import GuidanceModal from '../../components/GuidanceModal';
import { audioEngine } from '../../core/engine/AudioEngine';
import { getClefForPitches, resolvePlacement, pitchEqual, pitchForAnswerLetter } from '../../core/engine/pitchUtils';
import { playIntervalPairAudio, WRONG_FEEDBACK_RESET_MS } from '../../core/engine/intervalAudio';
import { useBlinkTimer } from '../../hooks/useBlinkTimer';
import { extractNoteAnswer } from './noteAnswer';
import { interactiveAOptions } from './noteOptions';

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

function generateOptions(slice: Slice): string[] {
  const content = slice.content as unknown as Record<string, unknown>;

  // 教师指定选项时直接使用（打乱顺序保证随机性）
  const fixedOptions = content.options as string[] | undefined;
  if (fixedOptions && fixedOptions.length >= 2) {
    return [...fixedOptions].sort(() => Math.random() - 0.5);
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
    case 'patterns':
      correct = (content.raw as string) || (content.pattern as string) || '';
      pool = ALL_PATTERNS;
      break;
  }

  if (!correct) return ['—', '—', '—', '—'];

  const distractors = pool
    .filter(p => p !== correct)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  return [correct, ...distractors].sort(() => Math.random() - 0.5);
}

// ============================================================
// 组件
// ============================================================
export default function InteractiveQuiz() {
  const { stageId } = useParams();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const slicesPool = useAppStore(state => state.slicesPool);
  const unlockNextStage = useAppStore(state => state.unlockNextStage);
  const completeAdventureStage = useAppStore(state => state.completeAdventureStage);
  const recordPractice = useAppStore(state => state.recordPractice);

  // Track a session key that changes each time the component mounts (new attempt)
  const [sessionKey] = useState(() => Math.random());

  // 冒险闯关统计：跟踪正确/错误数、总用时
  const correctCountRef = useRef(0);
  const wrongCountRef = useRef(0);
  const questStartRef = useRef(Date.now());

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

  // 记录每道题的开始时间，用于 practice_records 的 time_spent_ms
  const questionStartedRef = useRef(Date.now());
  useEffect(() => {
    questionStartedRef.current = Date.now();
  }, [currentSliceIndex]);

  const currentSlice = stage?.slices[currentSliceIndex];

  // Blink effect: show note for 3s, hide for 6s, loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const blinkResetKey = `${currentSliceIndex}_${introDismissed}`;
  const { noteVisible, resetBlink } = useBlinkTimer(3000, 6000, blinkResetKey);

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
      if (noteA && noteB) {
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
          // 同音：渲染两个全音符，符干方向一致
          if (noteA === noteB) {
            const { key, accidental } = parsePitchForVexflow(noteA);
            const stemDir = resolveStemDirection(key, key, clef);
            const vfNotes = [0, 1].map(() => {
              const note = new StaveNote({ keys: [key], duration: 'w', clef, stemDirection: stemDir });
              if (accidental) note.addModifier(new Accidental(accidental));
              return note;
            });
            const voice = new Voice({ numBeats: 8, beatValue: 4 });
            voice.setMode(2);
            voice.addTickables(vfNotes);
            new Formatter().joinVoices([voice]).format([voice], 40);
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
        // ---- D: 音型 → 画四分音符序列 ----
        const content = currentSlice.content as unknown as Record<string, unknown>;
        const rawStr: string = (content.raw as string) || (content.pattern as string) || '';
        console.log('[Pattern] raw:', rawStr, 'content:', JSON.stringify(currentSlice.content));

        let noteNames: string[] = rawStr.match(/[A-Ga-g][#b]?\d/g) || [];
        console.log('[Pattern] step1 fromRaw:', noteNames);

        if (noteNames.length < 2 && Array.isArray(content.notes) && content.notes.length >= 2) {
          noteNames = content.notes as string[];
          console.log('[Pattern] step2 fromNotes:', noteNames);
        }

        if (noteNames.length < 2) {
          for (const [key, notes] of Object.entries(PATTERN_DEFAULT_NOTES)) {
            if (rawStr.includes(key)) {
              noteNames = notes;
              console.log('[Pattern] step3 fromDefault key:', key, noteNames);
              break;
            }
          }
        }

        if (noteNames.length < 2) {
          noteNames = ['C4', 'D4', 'E4', 'F4', 'G4'];
          console.log('[Pattern] step4 ultimateFallback:', noteNames);
        }

        console.log('[Pattern] final noteNames:', noteNames);

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
    return generateOptions(currentSlice);
  }, [currentSlice]);

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
    if (feedback !== 'none' || !currentSlice) return;
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
      setFeedback('correct');
      correctCountRef.current += 1;  // 跟踪冒险闯关统计
      setTimeout(() => {
        audioEngine.stop();
        setFeedback('none');
        if (currentSliceIndex < stage.slices.length - 1) {
          setCurrentSliceIndex(prev => prev + 1);
        } else {
          if (stage.module === 'adventure') {
            const timeSec = Math.round((Date.now() - questStartRef.current) / 1000);
            completeAdventureStage(stage.id, {
              correctCount: correctCountRef.current,
              wrongCount: wrongCountRef.current,
              timeSpentSec: timeSec,
            });
            navigate('/client/adventure');
          } else {
            unlockNextStage(stage.module, stageIndex);
            navigate(-1);
            setTimeout(() => alert('🎉 Stage Cleared!'), 100);
          }
        }
      }, 800);
    } else {
      setFeedback('wrong');
      wrongCountRef.current += 1;  // 跟踪冒险闯关统计
      setTimeout(() => setFeedback('none'), WRONG_FEEDBACK_RESET_MS);
    }
  };
  handleAnswerRef.current = handleAnswer;

  const progressPercent = ((currentSliceIndex) / stage.slices.length) * 100;

  // B 类的题目用纯文字大卡片展示（不用 VexFlow）
  const isSymbolType = currentSlice?.module === 'symbols';

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
          onClick={() => navigate(-1)}
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
            {options.map((opt, i) => (
              <button
                key={`${currentSliceIndex}_${i}_${opt}`}
                onClick={() => {
                  if (audioEnabled && currentSlice) {
                    if (currentSlice.module === 'notes') {
                      void audioEngine.playNote(pitchForAnswerLetter(opt, referencePitch));
                    } else if (currentSlice.module === 'theory') {
                      const content = currentSlice.content as unknown as Record<string, unknown>;
                      const noteA = content.noteA as string | undefined;
                      const noteB = content.noteB as string | undefined;
                      if (noteA && noteB) playIntervalPairAudio(noteA, noteB);
                    }
                  }
                  handleAnswer(opt);
                }}
                style={{
                  minWidth: '140px',
                  maxWidth: '260px',
                  padding: '14px 20px',
                  borderRadius: '20px',
                  border: '1px solid #f3f4f6',
                  background: 'white',
                  fontSize: opt.length > 20 ? '0.85rem' : opt.length > 10 ? '1rem' : '1.5rem',
                  fontWeight: '700',
                  color: '#374151',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: '1.4',
                  textAlign: 'center'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 12px 20px rgba(0,0,0,0.06)';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
                onMouseDown={e => {
                  if (audioEnabled) void audioEngine.prime();
                  e.currentTarget.style.transform = 'translateY(2px) scale(0.96)';
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.color = '#3b82f6';
                }}
                onMouseUp={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.color = '#374151';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.color = '#374151';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.03)';
                  e.currentTarget.style.borderColor = '#f3f4f6';
                }}
              >
                {opt}
              </button>
            ))}
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
