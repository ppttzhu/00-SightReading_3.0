import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Slice {
  id: string;
  type: 'A' | 'B' | 'C' | 'D'; // 单音 | 符号 | 乐理 | 音型
  content: any;
  difficulty: number;
}

// 类型到模块ID的映射
const TYPE_TO_MODULE: Record<string, string> = {
  'A': 'notes',
  'B': 'symbols',
  'C': 'theory',
  'D': 'patterns',
};

// 自动根据素材池生成关卡 (按类型分组，再按难度区间切分)
function autoGenerateStages(pool: Slice[]) {
  const stages: AutoStage[] = [];
  const QUESTIONS_PER_STAGE = 5; // 每关 5 道题

  (['A', 'B', 'C', 'D'] as const).forEach(type => {
    const moduleId = TYPE_TO_MODULE[type];
    const typeSlices = pool.filter(s => s.type === type);
    if (typeSlices.length === 0) return;

    const sorted = [...typeSlices].sort((a, b) => a.difficulty - b.difficulty);

    for (let i = 0; i < sorted.length; i += QUESTIONS_PER_STAGE) {
      const batch = sorted.slice(i, i + QUESTIONS_PER_STAGE);
      const stageNum = Math.floor(i / QUESTIONS_PER_STAGE) + 1;
      const minDiff = batch[0].difficulty;
      const maxDiff = batch[batch.length - 1].difficulty;
      const diffLabel = minDiff === maxDiff ? `L${minDiff}` : `L${minDiff}-${maxDiff}`;

      stages.push({
        id: `auto_${moduleId}_stage_${stageNum}`,
        module: moduleId,
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
}

interface AppState {
  slicesPool: Slice[];
  customStages: CustomStage[];
  studentProgress: Record<string, number>;

  getAutoStages: (moduleId: string) => AutoStage[];
  /** 自动关卡 + 自定义关卡，统一格式返回 */
  getAllStages: (moduleId: string) => AutoStage[];

  addSlices: (slices: Slice[]) => void;
  updateSliceDifficulty: (id: string, diffDelta: number) => void;
  removeSlice: (id: string) => void;
  clearPool: () => void;

  addCustomStage: (stage: CustomStage) => void;
  updateCustomStage: (id: string, patch: Partial<Pick<CustomStage, 'title' | 'sliceIds'>>) => void;
  removeCustomStage: (id: string) => void;

  unlockNextStage: (moduleId: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      slicesPool: [],
      customStages: [],
      studentProgress: {
        notes: 1,
        symbols: 1,
        theory: 1,
        patterns: 1,
      },

      getAutoStages: (moduleId) => {
        const pool = get().slicesPool;
        return autoGenerateStages(pool).filter(s => s.module === moduleId);
      },

      getAllStages: (moduleId) => {
        const state = get();
        const auto = autoGenerateStages(state.slicesPool).filter(s => s.module === moduleId);

        const custom: AutoStage[] = state.customStages
          .filter(cs => cs.module === moduleId)
          .map((cs, idx) => {
            const slices = cs.sliceIds
              .map(sid => state.slicesPool.find(s => s.id === sid))
              .filter(Boolean) as Slice[];
            return {
              id: cs.id,
              module: cs.module,
              stageNum: auto.length + idx + 1,
              title: cs.title,
              slices,
            };
          })
          .filter(s => s.slices.length > 0);

        return [...auto, ...custom];
      },

      addSlices: (slices) => set((state) => {
        const newPool = [...state.slicesPool];
        slices.forEach(slice => {
          const sliceKey = slice.content.raw || slice.content.symbol || slice.content.theory || slice.content.pattern;
          const isDuplicate = newPool.some(existing => {
            const existingKey = existing.content.raw || existing.content.symbol || existing.content.theory || existing.content.pattern;
            return existing.type === slice.type && existingKey === sliceKey;
          });
          if (!isDuplicate) newPool.push(slice);
        });
        return { slicesPool: newPool };
      }),

      updateSliceDifficulty: (id, diffDelta) => set((state) => ({
        slicesPool: state.slicesPool.map(slice =>
          slice.id === id
            ? { ...slice, difficulty: Math.max(1, Math.min(10, slice.difficulty + diffDelta)) }
            : slice
        ),
      })),

      removeSlice: (id) => set((state) => ({
        slicesPool: state.slicesPool.filter(s => s.id !== id),
      })),

      clearPool: () => set({ slicesPool: [] }),

      addCustomStage: (stage) => set((state) => ({
        customStages: [...state.customStages, stage],
      })),

      updateCustomStage: (id, patch) => set((state) => ({
        customStages: state.customStages.map(cs =>
          cs.id === id ? { ...cs, ...patch } : cs
        ),
      })),

      removeCustomStage: (id) => set((state) => ({
        customStages: state.customStages.filter(cs => cs.id !== id),
      })),

      unlockNextStage: (moduleId) => set((state) => ({
        studentProgress: {
          ...state.studentProgress,
          [moduleId]: (state.studentProgress[moduleId] || 1) + 1,
        },
      })),
    }),
    { name: 'sight-reading-v2-store' }
  )
);
