import type { StageData, StorageProvider } from './types';
import type { Slice, CustomStage } from '../store/useAppStore';
import { supabase } from '../auth/supabaseClient';

/**
 * Supabase Storage Provider
 *
 * 读：所有人可读（slices / stages / stage_slices 启用了 SELECT 全部）
 * 写：必须以 admin 身份登录（RLS：current_user_role() = 'admin'）
 *
 * 数据映射：
 *   - Slice            ↔ public.slices
 *   - CustomStage      ↔ public.stages (+ stage_slices 多对多)
 *   - stageOrder[mod]  ↔ public.stages.sort_index（按 module 分组的序号）
 *
 * 不在本 provider 范围：student_progress / practice_records / user_type_stats
 *   这些走 useAppStore 中的独立 action（任务 4），不属于发布动作。
 */

const CHUNK_SIZE = 500;

type SliceRow = {
  id: string;
  module: 'notes' | 'symbols' | 'theory' | 'patterns';
  content: Record<string, unknown>;
  difficulty: number;
  del_status: boolean;
  created_at?: string;
};

type StageRow = {
  id: string;
  module: 'notes' | 'symbols' | 'theory' | 'patterns';
  title: string;
  is_preset: boolean;
  sort_index: number;
  question_count: number;
  del_status: boolean;
};

type StageSliceRow = {
  stage_id: string;
  quiz_id: string;
  position: number;
  del_status: boolean;
};

function ensureClient() {
  if (!supabase) {
    throw new Error('Supabase 未配置：请检查 VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY。');
  }
  return supabase;
}

function sliceToRow(slice: Slice): SliceRow {
  return {
    id: slice.id,
    module: slice.module,
    content: slice.content as unknown as Record<string, unknown> ?? {},
    difficulty: slice.difficulty,
    del_status: false,
  };
}

function rowToSlice(row: SliceRow): Slice {
  return {
    id: row.id,
    module: row.module,
    content: row.content as unknown as import('../../core/store/useAppStore').SliceContent ?? {},
    difficulty: row.difficulty,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined,
  };
}

async function chunkedUpsertSlices(rows: SliceRow[]): Promise<void> {
  const client = ensureClient();
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const { error } = await client
      .from('quizzes')
      .upsert(rows.slice(i, i + CHUNK_SIZE) as never, { onConflict: 'id' });
    if (error) throw new Error(`[Supabase] upsert slices 失败：${error.message}`);
  }
}

async function chunkedUpsertStages(rows: StageRow[]): Promise<void> {
  const client = ensureClient();
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const { error } = await client
      .from('stages')
      .upsert(rows.slice(i, i + CHUNK_SIZE) as never, { onConflict: 'id' });
    if (error) throw new Error(`[Supabase] upsert stages 失败：${error.message}`);
  }
}

async function chunkedUpsertStageSlices(rows: StageSliceRow[]): Promise<void> {
  const client = ensureClient();
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const { error } = await client
      .from('stage_quizzes')
      .upsert(rows.slice(i, i + CHUNK_SIZE) as never, { onConflict: 'stage_id,quiz_id' });
    if (error) throw new Error(`[Supabase] upsert stage_slices 失败：${error.message}`);
  }
}

export class SupabaseStorageProvider implements StorageProvider {
  name = 'Supabase';

  async save(data: StageData): Promise<void> {
    const client = ensureClient();

    // 1. slices：直接 upsert（admin RLS 已校验）
    const sliceRows = data.slicesPool.map(sliceToRow);
    await chunkedUpsertSlices(sliceRows);

    // 2. stages + stage_slices
    //    stageOrder 按 module 维护 sort_index；
    //    customStages 中没出现在任何 order 里的，把 sort_index 设到 1000 + idx 兜底。
    const stageRows: StageRow[] = [];
    const stageSliceRows: StageSliceRow[] = [];

    const moduleSortIndex: Record<string, number> = {
      notes: 0,
      symbols: 0,
      theory: 0,
      patterns: 0,
    };

    // 按 customStages 顺序写入，每个 module 内 sort_index 递增。
    for (const stage of data.customStages) {
      const module = stage.module;
      const sortIndex = moduleSortIndex[module]++;
      stageRows.push({
        id: stage.id,
        module,
        title: stage.title,
        is_preset: Boolean(stage.isPreset),
        sort_index: sortIndex,
        question_count: stage.questionCount || stage.sliceIds.length || 5,
        del_status: false,
      });

      stage.sliceIds.forEach((sliceId, position) => {
        stageSliceRows.push({
          stage_id: stage.id,
          quiz_id: sliceId,
          position,
          del_status: false,
        });
      });
    }

    await chunkedUpsertStages(stageRows);
    await chunkedUpsertStageSlices(stageSliceRows);

    // ── 精确软删：远端有但本地没有的 → 标 del_status = true ──
    // 先拉远端所有活跃 ID，与本地差集后逐条软删。避免用 PostgREST 的
    // not-in 语法（不同版本兼容性差）。

    // --- slices 差集 ---
    {
      const { data: dbRows, error: fetchErr } = await client
        .from('quizzes')
        .select('id')
        .eq('del_status', false);
      if (fetchErr) throw new Error(`[Supabase] 拉取 slices 差集失败：${fetchErr.message}`);

      const dbIds = new Set((dbRows ?? []).map((r: any) => r.id));
      const localIds = new Set(data.slicesPool.map((s) => s.id));
      for (const staleId of dbIds) {
        if (!localIds.has(staleId)) {
          const { error: delErr } = await client
            .from('quizzes')
            .update({ del_status: true })
            .eq('id', staleId);
          if (delErr) throw new Error(`[Supabase] 软删 slice ${staleId} 失败：${delErr.message}`);
        }
      }
    }

    // --- stages 差集 ---
    {
      const { data: dbRows, error: fetchErr } = await client
        .from('stages')
        .select('id')
        .eq('del_status', false);
      if (fetchErr) throw new Error(`[Supabase] 拉取 stages 差集失败：${fetchErr.message}`);

      const dbIds = new Set((dbRows ?? []).map((r: any) => r.id));
      const localIds = new Set(data.customStages.map((s) => s.id));
      for (const staleId of dbIds) {
        if (!localIds.has(staleId)) {
          const { error: delErr } = await client
            .from('stages')
            .update({ del_status: true })
            .eq('id', staleId);
          if (delErr) throw new Error(`[Supabase] 软删 stage ${staleId} 失败：${delErr.message}`);
        }
      }
    }

    // --- stage_slices 差集 ---
    {
      const { data: dbRows, error: fetchErr } = await client
        .from('stage_quizzes')
        .select('stage_id,quiz_id')
        .eq('del_status', false);
      if (fetchErr) throw new Error(`[Supabase] 拉取 stage_slices 差集失败：${fetchErr.message}`);

      const localPairs = new Set(stageSliceRows.map((r) => `${r.stage_id}::${r.quiz_id}`));
      for (const row of (dbRows ?? []) as any[]) {
        const key = `${row.stage_id}::${row.quiz_id}`;
        if (!localPairs.has(key)) {
          const { error: delErr } = await client
            .from('stage_quizzes')
            .update({ del_status: true })
            .eq('stage_id', row.stage_id)
            .eq('quiz_id', row.quiz_id);
          if (delErr) throw new Error(`[Supabase] 软删 stage_slice ${key} 失败：${delErr.message}`);
        }
      }
    }
  }

  async load(): Promise<StageData | null> {
    const client = ensureClient();

    const [slicesRes, stagesRes, stageSlicesRes] = await Promise.all([
      client
        .from('quizzes')
        .select('id,module,content,difficulty,del_status,created_at')
        .eq('del_status', false),
      client
        .from('stages')
        .select('id,module,title,is_preset,sort_index,question_count,del_status')
        .eq('del_status', false)
        .order('module', { ascending: true })
        .order('sort_index', { ascending: true }),
      client
        .from('stage_quizzes')
        .select('stage_id,quiz_id,position,del_status')
        .eq('del_status', false)
        .order('stage_id', { ascending: true })
        .order('position', { ascending: true }),
    ]);

    if (slicesRes.error) throw new Error(`[Supabase] 加载 slices 失败：${slicesRes.error.message}`);
    if (stagesRes.error) throw new Error(`[Supabase] 加载 stages 失败：${stagesRes.error.message}`);
    if (stageSlicesRes.error) throw new Error(`[Supabase] 加载 stage_slices 失败：${stageSlicesRes.error.message}`);

    const sliceRows = (slicesRes.data ?? []) as SliceRow[];
    const stageRows = (stagesRes.data ?? []) as StageRow[];
    const stageSliceRows = (stageSlicesRes.data ?? []) as StageSliceRow[];

    const slicesPool: Slice[] = sliceRows.map(rowToSlice);

    const stageIdToSliceIds = new Map<string, string[]>();
    for (const r of stageSliceRows) {
      const arr = stageIdToSliceIds.get(r.stage_id) ?? [];
      arr.push(r.quiz_id);
      stageIdToSliceIds.set(r.stage_id, arr);
    }

    const customStages: CustomStage[] = stageRows.map((row) => ({
      id: row.id,
      module: row.module,
      title: row.title,
      isPreset: row.is_preset,
      sliceIds: stageIdToSliceIds.get(row.id) ?? [],
      questionCount: row.question_count,
    }));

    return {
      slicesPool,
      customStages,
      updatedAt: new Date().toISOString(),
    };
  }
}
