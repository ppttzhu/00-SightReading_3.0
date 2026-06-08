import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getGrandStaffPlacement } from '../engine/pitchUtils';
import { supabase } from '../auth/supabaseClient';
import type { StaffPlacement } from '../engine/pitchUtils';
import {
  syncUpsertSlices,
  syncUpdateSliceDifficulty,
  syncSoftDeleteSlice,
  syncSoftDeleteAllSlices,
  syncUpsertStage,
  syncSoftDeleteStage,
  syncRewriteStageOrder,
  syncRecordPractice,
  syncUpsertStudentProgress,
  syncRecordAdventureCompletion,
  syncLoadAdventureCompletedStageIds,
} from '../storage/syncOps';

// ── Content Types ────────────────────────────────────────────
/** 单音题目 content */
export interface NoteContent {
  pitch: string;
  raw: string;
  placement: StaffPlacement;
  options?: string[];
}

/** 音乐符号题目 content */
export interface SymbolContent {
  symbol: string;
  answer: string;
  options?: string[];
}

/** 双音/音程题目 content */
export interface IntervalContent {
  noteA: string;
  noteB: string;
  theory: string;
  placement: StaffPlacement;
  raw: string;
  options?: string[];
}

/** 音型题目 content（支持和弦识别子类型） */
export interface PatternContent {
  pattern: string;
  raw: string;
  notes?: string[];
  options?: string[];

  // 和弦识别专用（可选，存在时标记为和弦题）
  chordType?: 'chord';
  chordName?: string;       // 和弦答案，如 'C Major'
  inversion?: string;       // 'root' | '1st' | '2nd' | '3rd' | ''
  displayMode?: 'block' | 'arpeggio';
}

export type SliceContent = NoteContent | SymbolContent | IntervalContent | PatternContent;

export interface Slice {
  id: string;
  module: 'notes' | 'symbols' | 'theory' | 'patterns';
  content: SliceContent;
  difficulty: number;
  createdAt?: number;
}


/** True when two slices represent the same question (after placement resolution). */
export function areSlicesDuplicate(a: Slice, b: Slice): boolean {
  const aContent = a.content as unknown as Record<string, unknown>;
  const bContent = b.content as unknown as Record<string, unknown>;
  const keyA = aContent.raw || aContent.symbol || aContent.theory || aContent.pattern;
  const keyB = bContent.raw || bContent.symbol || bContent.theory || bContent.pattern;
  if (a.module !== b.module || keyA !== keyB) return false;
  if (a.module === 'notes') {
    const pa = aContent.placement || getGrandStaffPlacement((aContent.pitch as string) || (aContent.raw as string));
    const pb = bContent.placement || getGrandStaffPlacement((bContent.pitch as string) || (bContent.raw as string));
    return pa === pb;
  }
  if (a.module === 'theory') {
    const aNotes = aContent.notes as string[] | undefined;
    const bNotes = bContent.notes as string[] | undefined;
    const aNoteA = aContent.noteA as string || aNotes?.[0];
    const aNoteB = aContent.noteB as string || aNotes?.[1];
    const bNoteA = bContent.noteA as string || bNotes?.[0];
    const bNoteB = bContent.noteB as string || bNotes?.[1];
    return aNoteA === bNoteA && aNoteB === bNoteB;
  }
  if (a.module === 'patterns') {
    const aChordType = aContent.chordType as string | undefined;
    const bChordType = bContent.chordType as string | undefined;
    // 和弦题：按 chordName 去重（相同和弦名视为重复）
    if (aChordType === 'chord' && bChordType === 'chord') {
      return (aContent.chordName as string) === (bContent.chordName as string);
    }
    // 传统音型题保持原有去重逻辑
    return true;
  }
  return true;
}


export interface AutoStage {
  id: string;
  module: string;
  stageNum: number;
  title: string;
  description?: string;
  guidance?: string;
  guidanceImages?: GuidanceImage[];
  slices: Slice[];
  questionCount: number;
  noteDisplayMs?: number;          // 音符显示时间（毫秒），闯关模式设置后携带
  noteHiddenMs?: number;           // 音符隐藏时间（毫秒），闯关模式设置后携带
  passCriteria?: {                 // 通关标准，闯关模式使用
    enabled: boolean;
    minAccuracy: number;
  };
}

// ============================================================
// 手动关卡：教师自定义编排
// ============================================================
export type QuizModuleId = Slice['module']; // 'notes' | 'theory' | 'symbols' | 'patterns'

export interface GuidanceImage {
  id: string;
  url: string;
  alt?: string;
  fileSize?: number;
}

export interface AdventureStage {
  id: string;
  title: string;
  description?: string;            // 关卡卡片说明（冒险地图卡片上显示的文字）
  guidance?: string;               // 学习指导 Markdown，用 {image:id} 占位符引用图片
  guidanceImages?: GuidanceImage[]; // 学习指导中的图片列表
  levelNum: number;
  sourceStageId: string;           // 引用 customStages.id，不再为可选（删除时已有引用检查）
  sourceModule: QuizModuleId;      // 来源模块，用于 CMS 标签展示
  questionCount: number;
  noteDisplayMs?: number;          // 音符显示时间（毫秒），默认 3000
  noteHiddenMs?: number;           // 音符隐藏时间（毫秒），默认 6000
  passCriteria?: {                 // 通关标准
    enabled: boolean;              //   是否启用
    minAccuracy: number;           //   最低正确率百分比（1-100）
  };
  unlockRule: 'previous_clear';
  source?: 'manual' | 'assistant';
  createdAt?: number;
  updatedAt?: number;
}

export interface CustomStage {
  id: string;
  module: 'notes' | 'symbols' | 'theory' | 'patterns';
  title: string;
  sliceIds: string[]; // 引用 slicesPool 中的 id
  isPreset?: boolean;
  questionCount?: number;
  guidance?: string;  // 老师为该关卡撰写的「学习指导」Markdown 文本
}

export interface PracticeRecord {
  id: number;
  userId: string;
  stageId: string | null;
  quizId: string;
  module: string;
  isCorrect: boolean;
  answeredWrong: string | null;
  timeSpentMs: number | null;
  createdAt: string;
}

export interface UserQuizStats {
  userId: string;
  quizId: string;
  totalCount: number;
  correctCount: number;
  wrongCount: number;
  lastPracticedAt: string | null;
}

interface AppState {
  slicesPool: Slice[];
  customStages: CustomStage[];
  adventureStages: AdventureStage[];
  adventureCompletedStageIds: string[];
  stageOrder: Record<string, string[]>; // moduleId -> ordered stage ids
  studentProgress: Record<string, number>;

  /** 最近一次远端同步失败的描述；为 null 表示 OK 或尚未同步过。 */
  lastSyncError: string | null;

  getAllStages: (moduleId: string) => AutoStage[];
  getAdventureStages: () => AutoStage[];

  addSlices: (slices: Slice[]) => { added: Slice[]; skipped: Slice[] };
  updateSlice: (id: string, patch: Partial<Slice>) => void;
  updateSliceDifficulty: (id: string, diffDelta: number) => void;
  removeSlice: (id: string) => void;
  clearPool: () => void;

  setAdventureStages: (stages: AdventureStage[]) => void;
  addAdventureStage: (stage: Omit<AdventureStage, 'levelNum'> & { levelNum?: number }) => void;
  updateAdventureStage: (id: string, patch: Partial<Omit<AdventureStage, 'id'>>) => void;
  removeAdventureStage: (id: string) => void;
  moveAdventureStage: (id: string, direction: 'up' | 'down') => void;
  completeAdventureStage: (stageId: string, stats?: { correctCount: number; wrongCount: number; timeSpentSec: number; passed?: boolean }) => void;

  addCustomStage: (stage: CustomStage) => void;
  updateCustomStage: (id: string, patch: Partial<CustomStage>) => void;
  removeCustomStage: (id: string) => void;

  setStageOrder: (moduleId: string, orderedIds: string[]) => void;

  unlockNextStage: (moduleId: string, completedStageIndex: number) => void;

  /** 记录一次答题；仅已登录学生会写入 practice_records。 */
  recordPractice: (params: {
    stageId?: string;
    quizId: string;
    module: 'notes' | 'symbols' | 'theory' | 'patterns';
    isCorrect: boolean;
    answeredWrong?: string;
    timeSpentMs?: number;
  }) => void;

  /** 拉取当前学生错题列表（isCorrect=false）或全部历史。 */
  fetchPracticeRecords: (params?: { isCorrect?: boolean }) => Promise<PracticeRecord[]>;

  /** 拉取当前学生各题目的统计汇总。 */
  fetchUserQuizStats: () => Promise<UserQuizStats[]>;

  // ── Admin 查询 action ──
  /** 列出全体学生（role = 'student'），仅 admin 可调用。 */
  fetchAllProfiles: () => Promise<{ id: string; nickname: string; role: string }[]>;
  /** 拉取全体学生的题目统计，仅 admin 可调用。 */
  fetchAllUserQuizStats: () => Promise<UserQuizStats[]>;
  /** 拉取全体学生的模块解锁进度，仅 admin 可调用。 */
  fetchAllStudentProgress: () => Promise<{ userId: string; module: string; unlocked: number }[]>;
  /** 拉取指定学生的答题记录，仅 admin 可调用。支持分页和错题筛选。 */
  fetchStudentPracticeRecords: (
    userId: string,
    params?: { isCorrect?: boolean; limit?: number; offset?: number },
  ) => Promise<PracticeRecord[]>;

  /** 拉取远端全量数据并替换本地 slicesPool / customStages / stageOrder。 */
  loadFromRemote: () => Promise<void>;

  /** 从 Supabase 拉取冒险进度，与本地合并（取并集）。 */
  loadAdventureProgressFromRemote: () => Promise<void>;
}

/** 计算指定 stage 在其 module 内的 sort_index（按 customStages 出现顺序）。 */
function moduleSortIndexOf(stages: CustomStage[], stageId: string): number {
  const target = stages.find((s) => s.id === stageId);
  if (!target) return 0;
  let idx = 0;
  for (const s of stages) {
    if (s.id === stageId) return idx;
    if (s.module === target.module) idx++;
  }
  return idx;
}

function orderAdventureStages(stages: AdventureStage[]): AdventureStage[] {
  return [...stages]
    .sort((a, b) => a.levelNum - b.levelNum || (a.createdAt || 0) - (b.createdAt || 0))
    .map((stage, index) => ({ ...stage, levelNum: index + 1 }));
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      slicesPool: [],
      customStages: [],
      adventureStages: [],
      adventureCompletedStageIds: [],
      stageOrder: {},
      studentProgress: {
        notes: 1,
        symbols: 1,
        theory: 1,
        patterns: 1,
      },
      lastSyncError: null,

      getAllStages: (moduleId) => {
        const state = get();
        const stages: AutoStage[] = state.customStages
          .filter(cs => cs.module === moduleId)
          .map((cs, idx) => {
            const slices = cs.sliceIds
              .map(sid => state.slicesPool.find(s => s.id === sid))
              .filter(Boolean) as Slice[];
            return { id: cs.id, module: cs.module, stageNum: idx + 1, title: cs.title, slices, questionCount: cs.questionCount || slices.length };
          })
          .filter(s => s.slices.length > 0);

        const order = state.stageOrder[moduleId];
        if (order && order.length > 0) {
          const stageMap = new Map(stages.map(s => [s.id, s]));
          return order.flatMap((id, idx) => {
            const s = stageMap.get(id);
            return s ? [{ ...s, stageNum: idx + 1 }] : [];
          });
        }
        return stages;
      },

      getAdventureStages: () => {
        const state = get();
        if (state.adventureStages.length === 0) return [];
        return orderAdventureStages(state.adventureStages).map((stage, idx) => {
          const sourceStage = state.customStages.find(cs => cs.id === stage.sourceStageId);
          if (!sourceStage) {
            return {
              id: stage.id,
              module: 'adventure',
              stageNum: idx + 1,
              title: stage.title,
              description: stage.description,
              guidance: stage.guidance,
              guidanceImages: stage.guidanceImages,
              slices: [],
              questionCount: 0,
              noteDisplayMs: stage.noteDisplayMs ?? 3000,
              noteHiddenMs: stage.noteHiddenMs ?? 6000,
              passCriteria: stage.passCriteria,
            };
          }
          const slices = sourceStage.sliceIds
            .map(sid => state.slicesPool.find(s => s.id === sid))
            .filter(Boolean) as Slice[];
          const qc = stage.questionCount || sourceStage.questionCount || sourceStage.sliceIds.length || slices.length;
          return {
            id: stage.id,
            module: 'adventure',
            stageNum: idx + 1,
            title: stage.title || sourceStage.title,
            description: stage.description || '',
            guidance: stage.guidance ?? sourceStage.guidance ?? '',
            guidanceImages: stage.guidanceImages ?? [],
            slices,
            questionCount: qc,
            noteDisplayMs: stage.noteDisplayMs ?? 3000,
            noteHiddenMs: stage.noteHiddenMs ?? 6000,
            passCriteria: stage.passCriteria,
          };
        });
      },

      addSlices: (slices) => {
        const now = Date.now();
        const accepted: Slice[] = [];
        const skipped: Slice[] = [];
        set((state) => {
          const newPool = [...state.slicesPool];
          slices.forEach(slice => {
            if (!newPool.some(existing => areSlicesDuplicate(existing, slice))) {
              const stamped = { ...slice, createdAt: slice.createdAt || now };
              newPool.push(stamped);
              accepted.push(stamped);
            } else {
              skipped.push(slice);
            }
          });
          return { slicesPool: newPool };
        });
        if (accepted.length > 0) void syncUpsertSlices(accepted);
        return { added: accepted, skipped };
      },

      updateSlice: (id, patch) => {
        let updated: Slice | null = null;
        set((state) => ({
          slicesPool: state.slicesPool.map(s => {
            if (s.id !== id) return s;
            updated = { ...s, ...patch };
            return updated;
          }),
        }));
        if (updated) void syncUpsertSlices([updated]);
      },

      updateSliceDifficulty: (id, diffDelta) => {
        let newDifficulty = 0;
        set((state) => ({
          slicesPool: state.slicesPool.map(slice => {
            if (slice.id !== id) return slice;
            newDifficulty = Math.max(1, Math.min(10, slice.difficulty + diffDelta));
            return { ...slice, difficulty: newDifficulty };
          }),
        }));
        if (newDifficulty > 0) void syncUpdateSliceDifficulty(id, newDifficulty);
      },

      removeSlice: (id) => {
        set((state) => ({
          slicesPool: state.slicesPool.filter(s => s.id !== id),
          customStages: state.customStages.map(cs => ({
            ...cs,
            sliceIds: cs.sliceIds.filter(sid => sid !== id),
          })),
        }));
        void syncSoftDeleteSlice(id);
      },

      clearPool: () => {
        set({ slicesPool: [] });
        void syncSoftDeleteAllSlices();
      },

      addCustomStage: (stage) => {
        set((state) => ({
          customStages: [...state.customStages, stage],
          stageOrder: {
            ...state.stageOrder,
            [stage.module]: [...(state.stageOrder[stage.module] || []), stage.id],
          },
        }));
        const sortIndex = moduleSortIndexOf(get().customStages, stage.id);
        void syncUpsertStage(stage, sortIndex);
      },

      updateCustomStage: (id, patch) => {
        set((state) => ({
          customStages: state.customStages.map(cs =>
            cs.id === id ? { ...cs, ...patch } : cs
          ),
        }));
        const updated = get().customStages.find(cs => cs.id === id);
        if (updated) {
          const sortIndex = moduleSortIndexOf(get().customStages, id);
          void syncUpsertStage(updated, sortIndex);
        }
      },

      removeCustomStage: (id) => {
        const state = get();
        const referencingAdventure = state.adventureStages.find(stage => stage.sourceStageId === id);
        if (referencingAdventure) {
          throw new Error(
            `无法删除：此关卡正在被冒险路线中的关卡「${referencingAdventure.title}」引用。请先在「主线编排」中移除该冒险关卡。`
          );
        }
        set((state) => ({
          customStages: state.customStages.filter(cs => cs.id !== id),
          stageOrder: Object.fromEntries(
            Object.entries(state.stageOrder).map(([mod, ids]) => [mod, ids.filter(i => i !== id)])
          ),
        }));
        void syncSoftDeleteStage(id);
      },

      setAdventureStages: (stages) => {
        set({ adventureStages: orderAdventureStages(stages) });
      },

      addAdventureStage: (stage) => {
        const now = Date.now();
        set((state) => ({
          adventureStages: orderAdventureStages([
            ...state.adventureStages,
            {
              id: stage.id,
              title: stage.title,
              description: stage.description,
              guidance: stage.guidance,
              guidanceImages: stage.guidanceImages,
              levelNum: stage.levelNum ?? state.adventureStages.length + 1,
              sourceStageId: stage.sourceStageId,
              sourceModule: stage.sourceModule,
              questionCount: stage.questionCount,
              unlockRule: 'previous_clear',
              source: stage.source || 'manual',
              createdAt: stage.createdAt || now,
              updatedAt: now,
            },
          ]),
        }));
      },

      updateAdventureStage: (id, patch) => {
        set((state) => ({
          adventureStages: orderAdventureStages(state.adventureStages.map(stage =>
            stage.id === id ? { ...stage, ...patch, updatedAt: Date.now() } : stage
          )),
        }));
      },

      removeAdventureStage: (id) => {
        set((state) => ({
          adventureStages: orderAdventureStages(state.adventureStages.filter(stage => stage.id !== id)),
        }));
      },

      moveAdventureStage: (id, direction) => {
        set((state) => {
          const ordered = orderAdventureStages(state.adventureStages);
          const index = ordered.findIndex(stage => stage.id === id);
          const targetIndex = direction === 'up' ? index - 1 : index + 1;
          if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return state;
          const next = [...ordered];
          const [moved] = next.splice(index, 1);
          next.splice(targetIndex, 0, moved);
          return {
            adventureStages: next.map((stage, i) => ({ ...stage, levelNum: i + 1 })),
          };
        });
      },

      completeAdventureStage: (stageId, stats) => {
        const passed = stats?.passed ?? true;
        set((state) => {
          // 只增不减：只要通过一次，就永久添加到完成列表，解锁下一关
          if (passed && !state.adventureCompletedStageIds.includes(stageId)) {
            return { adventureCompletedStageIds: [...state.adventureCompletedStageIds, stageId] };
          }
          return state;
        });
        void syncRecordAdventureCompletion(stageId, {
          correctCount: stats?.correctCount ?? 0,
          wrongCount: stats?.wrongCount ?? 0,
          timeSpentSec: stats?.timeSpentSec ?? 0,
          passed,
        });
      },

      setStageOrder: (moduleId, orderedIds) => {
        set((state) => ({
          stageOrder: { ...state.stageOrder, [moduleId]: orderedIds },
        }));
        void syncRewriteStageOrder(moduleId, orderedIds);
      },

      unlockNextStage: (moduleId, completedStageIndex) => {
        let newUnlocked = 0;
        set((state) => {
          const current = state.studentProgress[moduleId] || 1;
          if (completedStageIndex !== current) return state;
          newUnlocked = current + 1;
          return {
            studentProgress: { ...state.studentProgress, [moduleId]: newUnlocked },
          };
        });
        if (newUnlocked > 0) void syncUpsertStudentProgress(moduleId, newUnlocked);
      },

      recordPractice: (params) => {
        void syncRecordPractice(params);
      },

      fetchPracticeRecords: async (params) => {
        if (!supabase) return [];
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) return [];
        const userId = sessionData.session.user.id;

        let query = supabase
          .from('practice_records')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(500);

        if (params?.isCorrect !== undefined) {
          query = query.eq('is_correct', params.isCorrect);
        }

        const { data, error } = await query;
        if (error) {
          console.error('[fetchPracticeRecords]', error);
          set({ lastSyncError: `fetchPracticeRecords: ${error.message}` });
          return [];
        }
        const rows = data as unknown as Array<Record<string, any>>;
        return rows.map((r) => ({
          id: r.id as number,
          userId: r.user_id as string,
          stageId: (r.stage_id as string) ?? null,
          quizId: r.quiz_id as string,
          module: r.module as string,
          isCorrect: r.is_correct as boolean,
          answeredWrong: (r.answered_wrong as string) ?? null,
          timeSpentMs: (r.time_spent_ms as number) ?? null,
          createdAt: r.created_at as string,
        })) satisfies PracticeRecord[];
      },

      fetchUserQuizStats: async () => {
        if (!supabase) return [];
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) return [];
        const userId = sessionData.session.user.id;

        const { data, error } = await supabase
          .from('user_slice_stats')
          .select('*')
          .eq('user_id', userId);
        if (error) {
          console.error('[fetchUserQuizStats]', error);
          set({ lastSyncError: `fetchUserQuizStats: ${error.message}` });
          return [];
        }
        const rows = data as unknown as Array<Record<string, any>>;
        return rows.map((r) => ({
          userId: r.user_id as string,
          quizId: r.quiz_id as string,
          totalCount: (r.total_count ?? 0) as number,
          correctCount: (r.correct_count ?? 0) as number,
          wrongCount: (r.wrong_count ?? 0) as number,
          lastPracticedAt: (r.last_practiced_at as string) ?? null,
        })) satisfies UserQuizStats[];
      },

      // ── Admin 查询 action 实现 ──
      fetchAllProfiles: async () => {
        if (!supabase) return [];
        const { data, error } = await supabase
          .from('profiles')
          .select('id,nickname,role')
          .eq('del_status', false)
          .order('created_at', { ascending: true });
        if (error) {
          console.error('[fetchAllProfiles]', error);
          set({ lastSyncError: `fetchAllProfiles: ${error.message}` });
          return [];
        }
        return (data ?? []) as { id: string; nickname: string; role: string }[];
      },

      fetchAllUserQuizStats: async () => {
        if (!supabase) return [];
        const { data, error } = await supabase
          .from('user_slice_stats')
          .select('*')
          .order('user_id', { ascending: true });
        if (error) {
          console.error('[fetchAllUserQuizStats]', error);
          set({ lastSyncError: `fetchAllUserQuizStats: ${error.message}` });
          return [];
        }
        const rows = data as unknown as Array<Record<string, any>>;
        return rows.map((r) => ({
          userId: r.user_id as string,
          quizId: r.quiz_id as string,
          totalCount: (r.total_count ?? 0) as number,
          correctCount: (r.correct_count ?? 0) as number,
          wrongCount: (r.wrong_count ?? 0) as number,
          lastPracticedAt: (r.last_practiced_at as string) ?? null,
        })) satisfies UserQuizStats[];
      },

      fetchAllStudentProgress: async () => {
        if (!supabase) return [];
        const { data, error } = await supabase
          .from('student_progress')
          .select('user_id,module,unlocked');
        if (error) {
          console.error('[fetchAllStudentProgress]', error);
          set({ lastSyncError: `fetchAllStudentProgress: ${error.message}` });
          return [];
        }
        const rows = data as unknown as Array<Record<string, any>>;
        return rows.map((r) => ({
          userId: r.user_id as string,
          module: r.module as string,
          unlocked: (r.unlocked ?? 1) as number,
        }));
      },

      fetchStudentPracticeRecords: async (userId, params) => {
        if (!supabase) return [];
        let query = supabase
          .from('practice_records')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(params?.limit ?? 50);

        if (params?.offset) query = query.range(params.offset, params.offset + (params.limit ?? 50) - 1);
        if (params?.isCorrect !== undefined) query = query.eq('is_correct', params.isCorrect);

        const { data, error } = await query;
        if (error) {
          console.error('[fetchStudentPracticeRecords]', error);
          set({ lastSyncError: `fetchStudentPracticeRecords: ${error.message}` });
          return [];
        }
        const rows = data as unknown as Array<Record<string, any>>;
        return rows.map((r) => ({
          id: r.id as number,
          userId: r.user_id as string,
          stageId: (r.stage_id as string) ?? null,
          quizId: r.quiz_id as string,
          module: r.module as string,
          isCorrect: r.is_correct as boolean,
          answeredWrong: (r.answered_wrong as string) ?? null,
          timeSpentMs: (r.time_spent_ms as number) ?? null,
          createdAt: r.created_at as string,
        })) satisfies PracticeRecord[];
      },

      loadFromRemote: async () => {
        const { getStorageProvider } = await import('../storage');
        const provider = getStorageProvider();
        if (!provider) return;
        try {
          const data = await provider.load();
          if (!data) return;
          set({
            slicesPool: data.slicesPool,
            customStages: data.customStages,
            adventureStages: data.adventureStages || [],
            lastSyncError: null,
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          set({ lastSyncError: `load: ${message}` });
        }
      },

      loadAdventureProgressFromRemote: async () => {
        try {
          const remoteIds = await syncLoadAdventureCompletedStageIds();
          if (remoteIds.length === 0) return;
          set((state) => {
            const merged = new Set([...state.adventureCompletedStageIds, ...remoteIds]);
            return { adventureCompletedStageIds: [...merged] };
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.warn('[loadAdventureProgress]', message);
        }
      },
    }),
    { name: 'sight-reading-v2-store' }
  )
);
