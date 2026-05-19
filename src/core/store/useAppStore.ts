import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Slice {
  id: string;
  type: 'A' | 'B' | 'C' | 'D'; // 单音 | 符号 | 乐理 | 音型
  content: any;
  difficulty: number;
  createdAt?: number;
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
  isPreset?: boolean;
  guidance?: string;  // 老师为该关卡撰写的「学习指导」Markdown 文本
}

interface AppState {
  slicesPool: Slice[];
  customStages: CustomStage[];
  stageOrder: Record<string, string[]>; // moduleId -> ordered stage ids
  studentProgress: Record<string, number>;

  getAutoStages: (moduleId: string) => AutoStage[];
  getAllStages: (moduleId: string) => AutoStage[];

  addSlices: (slices: Slice[]) => void;
  updateSliceDifficulty: (id: string, diffDelta: number) => void;
  removeSlice: (id: string) => void;
  clearPool: () => void;

  addCustomStage: (stage: CustomStage) => void;
  updateCustomStage: (id: string, patch: Partial<Pick<CustomStage, 'title' | 'sliceIds' | 'guidance'>>) => void;
  removeCustomStage: (id: string) => void;

  generatePresetStages: (moduleId: string) => void;
  unpresetStage: (stageId: string) => void;
  clearPresetStages: (moduleId: string) => void;
  setStageOrder: (moduleId: string, orderedIds: string[]) => void;

  unlockNextStage: (moduleId: string, completedStageIndex: number) => void;
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

      addSlices: (slices) => set((state) => {
        const now = Date.now();
        const newPool = [...state.slicesPool];
        slices.forEach(slice => {
          const sliceKey = slice.content.raw || slice.content.symbol || slice.content.theory || slice.content.pattern;
          const isDuplicate = newPool.some(existing => {
            const existingKey = existing.content.raw || existing.content.symbol || existing.content.theory || existing.content.pattern;
            return existing.type === slice.type && existingKey === sliceKey;
          });
          if (!isDuplicate) newPool.push({ ...slice, createdAt: slice.createdAt || now });
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
        customStages: state.customStages.map(cs => ({
          ...cs,
          sliceIds: cs.sliceIds.filter(sid => sid !== id),
        })),
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
        stageOrder: Object.fromEntries(
          Object.entries(state.stageOrder).map(([mod, ids]) => [mod, ids.filter(i => i !== id)])
        ),
      })),

      generatePresetStages: (moduleId) => set((state) => {
        // 先记录旧 preset 关卡的 guidance（按 id），新生成的同 id preset 沿用
        const oldGuidanceById = new Map<string, string>();
        for (const cs of state.customStages) {
          if (cs.module === moduleId && cs.isPreset && cs.guidance) {
            oldGuidanceById.set(cs.id, cs.guidance);
          }
        }
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
          guidance: oldGuidanceById.get(s.id),  // 没旧值则 undefined
        }));
        const newCustomStages = [...withoutOldPresets, ...presets];
        // Build order: presets first, then existing manual stages for this module
        const manualIds = withoutOldPresets.filter(cs => cs.module === moduleId).map(cs => cs.id);
        const newOrder = [...presets.map(p => p.id), ...manualIds];
        return {
          customStages: newCustomStages,
          stageOrder: { ...state.stageOrder, [moduleId]: newOrder },
        };
      }),

      unpresetStage: (stageId) => set((state) => ({
        customStages: state.customStages.map(cs =>
          cs.id === stageId ? { ...cs, isPreset: false } : cs
        ),
      })),

      clearPresetStages: (moduleId) => set((state) => ({
        customStages: state.customStages.filter(
          cs => !(cs.module === moduleId && cs.isPreset)
        ),
        stageOrder: {
          ...state.stageOrder,
          [moduleId]: (state.stageOrder[moduleId] || []).filter(
            id => !state.customStages.some(cs => cs.id === id && cs.isPreset && cs.module === moduleId)
          ),
        },
      })),

      setStageOrder: (moduleId, orderedIds) => set((state) => ({
        stageOrder: { ...state.stageOrder, [moduleId]: orderedIds },
      })),

      unlockNextStage: (moduleId, completedStageIndex) => set((state) => {
        const current = state.studentProgress[moduleId] || 1;
        if (completedStageIndex !== current) return state;
        return {
          studentProgress: { ...state.studentProgress, [moduleId]: current + 1 },
        };
      }),
    }),
    { name: 'sight-reading-v2-store' }
  )
);
