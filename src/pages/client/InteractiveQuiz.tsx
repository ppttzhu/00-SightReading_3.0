import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'vexflow';
import { useAppStore, type Slice } from '../../core/store/useAppStore';

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

// ============================================================
// 选项生成器 (为每个类型生成正确答案 + 3 个干扰项)
// ============================================================

const ALL_INTERVALS = [
  '小二度 (m2)', '大二度 (M2)', '小三度 (m3)', '大三度 (M3)',
  '纯四度 (P4)', '三全音 (TT)', '纯五度 (P5)',
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

const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

function generateOptions(slice: Slice): string[] {
  let correct = '';
  let pool: string[] = [];

  switch (slice.type) {
    case 'A':
      // Extract just the note letter (e.g., "C#4" → "C", "Bb3" → "B")
      correct = (slice.content.pitch || '').charAt(0).toUpperCase();
      return NOTE_NAMES; // Always show all 7 notes
    case 'B': {
      const rawSymbol = slice.content.raw || slice.content.symbol || '';
      // 尝试通过 SYMBOL_MAP 将简称映射到完整标签
      correct = SYMBOL_MAP[rawSymbol] || rawSymbol;
      pool = ALL_SYMBOLS;
      break;
    }
    case 'C':
      correct = slice.content.theory || slice.content.raw || '';
      // 如果是音程，用音程池；如果是和弦或调号，用自身作为正确答案
      pool = correct.includes('度') || correct.includes('P') || correct.includes('m')
        ? ALL_INTERVALS
        : ['C大调', 'G大调', 'D大调', 'F大调', 'Bb大调', 'A大调', 'Eb大调', 'E大调',
           'C Major Chord', 'G Major Chord', 'D Minor Chord', 'F Major Chord',
           'Am Chord', 'Em Chord', 'Dm Chord'];
      break;
    case 'D':
      correct = slice.content.raw || slice.content.pattern || '';
      pool = ALL_PATTERNS;
      break;
  }

  if (!correct) return ['—', '—', '—', '—'];

  // 从池中选 3 个不等于正确答案的干扰项
  const distractors = pool
    .filter(p => p !== correct)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  // 混合并打乱
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

  // Track a session key that changes each time the component mounts (new attempt)
  const [sessionKey] = useState(() => Math.random());

  const stage = useMemo(() => {
    const parts = stageId?.split('_') || [];
    // 自定义关卡 id 格式: custom_xxx；自动关卡: auto_moduleId_stage_n
    const moduleId = parts[0] === 'custom'
      ? (useAppStore.getState().customStages.find(cs => cs.id === stageId)?.module || '')
      : parts[1] || '';
    const getAllStages = useAppStore.getState().getAllStages;
    const stages = getAllStages(moduleId);
    const found = stages.find(s => s.id === stageId) || null;
    if (found) {
      // Shuffle questions within the stage for variety on each play
      const shuffled = [...found.slices].sort(() => Math.random() - 0.5);
      return { ...found, slices: shuffled };
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageId, slicesPool, sessionKey]);

  const [currentSliceIndex, setCurrentSliceIndex] = useState(0);
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
  const [noteVisible, setNoteVisible] = useState(true);

  const currentSlice = stage?.slices[currentSliceIndex];

  // Blink effect: show note for 3s, hide for 6s, loop
  useEffect(() => {
    setNoteVisible(true);
    let timeout: ReturnType<typeof setTimeout>;
    const cycle = () => {
      timeout = setTimeout(() => {
        setNoteVisible(false);
        timeout = setTimeout(() => {
          setNoteVisible(true);
          cycle();
        }, 6000);
      }, 3000);
    };
    cycle();
    return () => clearTimeout(timeout);
  }, [currentSliceIndex]);

  // ============================================================
  // VexFlow 渲染 (根据题目类型绘制不同内容)
  // ============================================================
  useEffect(() => {
    if (!containerRef.current || !currentSlice) return;
    containerRef.current.innerHTML = '';

    // B 类（符号）不使用 VexFlow，用纯文字展示
    if (currentSlice.type === 'B') return;

    const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
    const width = Math.min(500, containerRef.current.clientWidth - 20);
    renderer.resize(width, 200);
    const context = renderer.getContext();
    // 不添加拍号，只加谱号
    const stave = new Stave(10, 40, width - 40);
    stave.addClef("treble");
    stave.setContext(context).draw();

    try {
      if (currentSlice.type === 'A') {
        // ---- A: 单音 → 画一个全音符 ----
        const { key, accidental } = parsePitchForVexflow(currentSlice.content.pitch);
        const note = new StaveNote({ keys: [key], duration: "w" });
        if (accidental) note.addModifier(new Accidental(accidental));

        const voice = new Voice({ numBeats: 4, beatValue: 4 });
        voice.setMode(2); // SOFT mode
        voice.addTickables([note]);
        new Formatter().joinVoices([voice]).format([voice], 350);
        voice.draw(context, stave);

      } else if (currentSlice.type === 'C') {
        // ---- C: 乐理 → 画音程(两个音)，紧凑排列 ----
        const noteNames: string[] = currentSlice.content.notes || [];
        if (noteNames.length >= 2) {
          // 音程：用二分音符，紧缩间距
          const vfNotes = noteNames.map(n => {
            const { key, accidental } = parsePitchForVexflow(n);
            const note = new StaveNote({ keys: [key], duration: "h" });
            if (accidental) note.addModifier(new Accidental(accidental));
            return note;
          });

          const beats = vfNotes.length * 2;
          const voice = new Voice({ numBeats: beats, beatValue: 4 });
          voice.setMode(2); // SOFT mode
          voice.addTickables(vfNotes);
          new Formatter().joinVoices([voice]).format([voice], 160);
          voice.draw(context, stave);
        }

      } else if (currentSlice.type === 'D') {
        // ---- D: 音型 → 画四分音符序列 ----
        const rawStr: string = currentSlice.content.raw || currentSlice.content.pattern || '';
        console.log('[Pattern] raw:', rawStr, 'content:', JSON.stringify(currentSlice.content));

        // 1. 从 raw 字符串提取带八度音符，如 C4、F#3、Bb5
        let noteNames: string[] = rawStr.match(/[A-Ga-g][#b]?\d/g) || [];
        console.log('[Pattern] step1 fromRaw:', noteNames);

        // 2. 没有则尝试 content.notes
        if (noteNames.length < 2 && Array.isArray(currentSlice.content.notes) && currentSlice.content.notes.length >= 2) {
          noteNames = currentSlice.content.notes;
          console.log('[Pattern] step2 fromNotes:', noteNames);
        }

        // 3. 兜底：按音型名称查预置示例音符
        if (noteNames.length < 2) {
          for (const [key, notes] of Object.entries(PATTERN_DEFAULT_NOTES)) {
            if (rawStr.includes(key)) {
              noteNames = notes;
              console.log('[Pattern] step3 fromDefault key:', key, noteNames);
              break;
            }
          }
        }

        // 4. 最终兜底：C大调上行音阶示例
        if (noteNames.length < 2) {
          noteNames = ['C4', 'D4', 'E4', 'F4', 'G4'];
          console.log('[Pattern] step4 ultimateFallback:', noteNames);
        }

        console.log('[Pattern] final noteNames:', noteNames);

        const vfNotes = noteNames.map(n => {
          const { key, accidental } = parsePitchForVexflow(n);
          const note = new StaveNote({ keys: [key], duration: 'q' });
          if (accidental) note.addModifier(new Accidental(accidental));
          return note;
        });

        const totalBeats = vfNotes.length;
        // SOFT 模式：不严格校验总拍数，避免静默失败
        const voice = new Voice({ numBeats: totalBeats, beatValue: 4 });
        voice.setMode(2); // SOFT mode
        voice.addTickables(vfNotes);
        new Formatter().joinVoices([voice]).format([voice], Math.min(360, totalBeats * 60));
        voice.draw(context, stave);
      }
    } catch (e) {
      console.error("VexFlow Draw Error:", e);
    }
  }, [currentSlice]);

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
    switch (currentSlice.type) {
      case 'A': return (currentSlice.content.pitch || '').charAt(0).toUpperCase();
      case 'B': {
        const rawSymbol = currentSlice.content.raw || currentSlice.content.symbol || '';
        return SYMBOL_MAP[rawSymbol] || rawSymbol;
      }
      case 'C': return currentSlice.content.theory || currentSlice.content.raw || '';
      case 'D': return currentSlice.content.raw || currentSlice.content.pattern || '';
      default: return '';
    }
  };

  const handleAnswer = (answer: string) => {
    if (feedback !== 'none') return;
    const correct = getCorrectAnswer();
    const isCorrect = answer === correct;

    if (isCorrect) {
      setFeedback('correct');
      setTimeout(() => {
        setFeedback('none');
        if (currentSliceIndex < stage.slices.length - 1) {
          setCurrentSliceIndex(prev => prev + 1);
        } else {
          unlockNextStage(stage.module);
          navigate(-1);
          setTimeout(() => alert('🎉 Stage Cleared!'), 100);
        }
      }, 800);
    } else {
      setFeedback('wrong');
      setTimeout(() => setFeedback('none'), 600);
    }
  };

  const progressPercent = ((currentSliceIndex) / stage.slices.length) * 100;

  // B 类的题目用纯文字大卡片展示（不用 VexFlow）
  const isSymbolType = currentSlice?.type === 'B';

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
        <div style={{ width: '150px', height: '8px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${progressPercent}%`, height: '100%', background: '#3b82f6', borderRadius: '4px', transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}></div>
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
                {currentSlice?.content.raw || currentSlice?.content.symbol || '?'}
              </div>
              <div style={{ fontSize: '1rem', color: '#9ca3af' }}>这是什么音乐记号？</div>
            </div>
          ) : (
            // A/C/D 类：用 VexFlow 渲染乐谱
            <div ref={containerRef} id="vexflow-container" style={{ opacity: noteVisible ? 1 : 0, transition: 'opacity 0.3s ease' }}></div>
          )}
        </div>

        {/* 选项区 */}
        <div className="quiz-options" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '700px' }}>
          {options.map((opt, i) => (
            <button
              key={`${currentSliceIndex}_${i}_${opt}`}
              onClick={() => handleAnswer(opt)}
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
    </div>
  );
}
