import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getGrandStaffPlacement } from '../engine/pitchUtils';
import { supabase } from '../auth/supabaseClient';
import {
  syncUpsertSlices,
  syncUpdateSliceDifficulty,
  syncSoftDeleteSlice,
  syncSoftDeleteAllSlices,
  syncUpsertStage,
  syncSoftDeleteStage,
  syncRewriteStageOrder,
  syncSoftDeletePresetStages,
  syncUnpresetStage,
  syncRecordPractice,
  syncUpsertStudentProgress,
} from '../storage/syncOps';

export interface Slice {
  id: string;
  module: 'notes' | 'symbols' | 'theory' | 'patterns';
  content: any;
  difficulty: number;
  createdAt?: number;
}


/** True when two slices represent the same question (after placement resolution). */
export function areSlicesDuplicate(a: Slice, b: Slice): boolean {
  const keyA = a.content.raw || a.content.symbol || a.content.theory || a.content.pattern;
  const keyB = b.content.raw || b.content.symbol || b.content.theory || b.content.pattern;
  if (a.module !== b.module || keyA !== keyB) return false;
  if (a.module === 'notes') {
    const pa = a.content.placement || getGrandStaffPlacement(a.content.pitch || a.content.raw);
    const pb = b.content.placement || getGrandStaffPlacement(b.content.pitch || b.content.raw);
    return pa === pb;
  }
  return true;
}

// 自动根据素材池生成关卡 (按模块分组，再按难度区间切分)
function autoGenerateStages(pool: Slice[]) {
  const stages: AutoStage[] = [];
  const QUESTIONS_PER_STAGE = 5; // 每关 5 道题

  (['notes', 'symbols', 'theory', 'patterns'] as const).forEach(module => {
    const moduleSlices = pool.filter(s => s.module === module);
    if (moduleSlices.length === 0) return;

    const sorted = [...moduleSlices].sort((a, b) => a.difficulty - b.difficulty);

    for (let i = 0; i < sorted.length; i += QUESTIONS_PER_STAGE) {
      const batch = sorted.slice(i, i + QUESTIONS_PER_STAGE);
      const stageNum = Math.floor(i / QUESTIONS_PER_STAGE) + 1;
      const minDiff = batch[0].difficulty;
      const maxDiff = batch[batch.length - 1].difficulty;
      const diffLabel = minDiff === maxDiff ? `L${minDiff}` : `L${minDiff}-${maxDiff}`;

      stages.push({
        id: `auto_${module}_stage_${stageNum}`,
        module,
        stageNum,
        title: `第${stageNum}关 (${diffLabel})`,
        slices: batch,
      });
    }
  });

  return stages;
}

export interface AutoStage {
  id: string;
  module: string;
  stageNum: number;
  title: string;
  slices: Slice[];
}

// ============================================================
// 手动关卡：教师自定义编排
// ============================================================
export interface CustomStage {
  id: string;
  module: 'notes' | 'symbols' | 'theory' | 'patterns';
  title: string;
  sliceIds: string[]; // 引用 slicesPool 中的 id
  isPreset?: boolean;
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
  stageOrder: Record<string, string[]>; // moduleId -> ordered stage ids
  studentProgress: Record<string, number>;

  /** 最近一次远端同步失败的描述；为 null 表示 OK 或尚未同步过。 */
  lastSyncError: string | null;

  getAutoStages: (moduleId: string) => AutoStage[];
  getAllStages: (moduleId: string) => AutoStage[];

  addSlices: (slices: Slice[]) => void;
  updateSliceDifficulty: (id: string, diffDelta: number) => void;
  removeSlice: (id: string) => void;
  clearPool: () => void;

  addCustomStage: (stage: CustomStage) => void;
  updateCustomStage: (id: string, patch: Partial<Pick<CustomStage, 'title' | 'sliceIds'>>) => void;
  removeCustomStage: (id: string) => void;

  generatePresetStages: (moduleId: string) => void;
  unpresetStage: (stageId: string) => void;
  clearPresetStages: (moduleId: string) => void;
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

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      slicesPool: [],
      customStages: [],
      stageOrder: {},
      studentProgress: {
        notes: 1,
        symbols: 1,
        theory: 1,
        patterns: 1,
      },
      lastSyncError: null,

      getAutoStages: (moduleId) => {
        const pool = get().slicesPool;
        return autoGenerateStages(pool).filter(s => s.module === moduleId);
      },

      getAllStages: (moduleId) => {
        const state = get();
        const order = state.stageOrder[moduleId];

        // If preset stages have been generated, use stageOrder
        if (order && order.length > 0) {
          const stageMap = new Map<string, AutoStage>();
          state.customStages
            .filter(cs => cs.module === moduleId)
            .forEach((cs, idx) => {
              const slices = cs.sliceIds
                .map(sid => state.slicesPool.find(s => s.id === sid))
                .filter(Boolean) as Slice[];
              if (slices.length > 0) {
                stageMap.set(cs.id, { id: cs.id, module: cs.module, stageNum: idx + 1, title: cs.title, slices });
              }
            });
          return order.flatMap((id, idx) => {
            const s = stageMap.get(id);
            return s ? [{ ...s, stageNum: idx + 1 }] : [];
          });
        }

        // Fallback: original dynamic generation
        const usedInCustom = new Set(state.customStages.flatMap(cs => cs.sliceIds));
        const freePool = state.slicesPool.filter(s => !usedInCustom.has(s.id));
        const auto = autoGenerateStages(freePool).filter(s => s.module === moduleId);
        const custom: AutoStage[] = state.customStages
          .filter(cs => cs.module === moduleId)
          .map((cs, idx) => {
            const slices = cs.sliceIds
              .map(sid => state.slicesPool.find(s => s.id === sid))
              .filter(Boolean) as Slice[];
            return { id: cs.id, module: cs.module, stageNum: auto.length + idx + 1, title: cs.title, slices };
          })
          .filter(s => s.slices.length > 0);
        return [...auto, ...custom];
      },

      addSlices: (slices) => {
        const now = Date.now();
        const accepted: Slice[] = [];
        set((state) => {
          const newPool = [...state.slicesPool];
          slices.forEach(slice => {
            if (!newPool.some(existing => areSlicesDuplicate(existing, slice))) {
              const stamped = { ...slice, createdAt: slice.createdAt || now };
              newPool.push(stamped);
              accepted.push(stamped);
            }
          });
          return { slicesPool: newPool };
        });
        if (accepted.length > 0) void syncUpsertSlices(accepted);
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
        set((state) => ({
          customStages: state.customStages.filter(cs => cs.id !== id),
          stageOrder: Object.fromEntries(
            Object.entries(state.stageOrder).map(([mod, ids]) => [mod, ids.filter(i => i !== id)])
          ),
        }));
        void syncSoftDeleteStage(id);
      },

      generatePresetStages: (moduleId) => {
        let newPresets: CustomStage[] = [];
        let newOrder: string[] = [];
        set((state) => {
          // Remove old presets for this module
          const withoutOldPresets = state.customStages.filter(
            cs => !(cs.module === moduleId && cs.isPreset)
          );
          // Compute free pool (not used by non-preset custom stages)
          const usedByCustom = new Set(
            withoutOldPresets.filter(cs => cs.module === moduleId).flatMap(cs => cs.sliceIds)
          );
          const freePool = state.slicesPool.filter(s => !usedByCustom.has(s.id));
          const autoStages = autoGenerateStages(freePool).filter(s => s.module === moduleId);
          const presets: CustomStage[] = autoStages.map(s => ({
            id: s.id,
            module: moduleId as CustomStage['module'],
            title: s.title,
            sliceIds: s.slices.map(sl => sl.id),
            isPreset: true,
          }));
          const newCustomStages = [...withoutOldPresets, ...presets];
          // Build order: presets first, then existing manual stages for this module
          const manualIds = withoutOldPresets.filter(cs => cs.module === moduleId).map(cs => cs.id);
          newPresets = presets;
          newOrder = [...presets.map(p => p.id), ...manualIds];
          return {
            customStages: newCustomStages,
            stageOrder: { ...state.stageOrder, [moduleId]: newOrder },
          };
        });
        // 同步：先把旧 preset 软删，再 upsert 新 preset，最后写 sort_index
        void (async () => {
          await syncSoftDeletePresetStages(moduleId);
          for (let i = 0; i < newPresets.length; i++) {
            await syncUpsertStage(newPresets[i], i);
          }
          await syncRewriteStageOrder(moduleId, newOrder);
        })();
      },

      unpresetStage: (stageId) => {
        set((state) => ({
          customStages: state.customStages.map(cs =>
            cs.id === stageId ? { ...cs, isPreset: false } : cs
          ),
        }));
        void syncUnpresetStage(stageId);
      },

      clearPresetStages: (moduleId) => {
        set((state) => ({
          customStages: state.customStages.filter(
            cs => !(cs.module === moduleId && cs.isPreset)
          ),
          stageOrder: {
            ...state.stageOrder,
            [moduleId]: (state.stageOrder[moduleId] || []).filter(
              id => !state.customStages.some(cs => cs.id === id && cs.isPreset && cs.module === moduleId)
            ),
          },
        }));
        void syncSoftDeletePresetStages(moduleId);
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
            lastSyncError: null,
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          set({ lastSyncError: `load: ${message}` });
        }
      },
    }),
    { name: 'sight-reading-v2-store' }
  )
);
