/**
 * 细粒度 Supabase 同步层
 *
 * 设计：fire-and-forget。store mutation 仍然同步返回、本地立即生效；
 *       这里的函数被 `void` 调用，错误只 console.error + 上报到 useAppStore.lastSyncError。
 *
 * 写入仅在 admin 登录后才会被 RLS 放行，未登录时这些 fetch 会失败 —— 我们检测
 * `supabase.auth.getSession()`，没有 session 时直接跳过，避免无意义的网络请求。
 */

import { supabase } from '../auth/supabaseClient';
import type { Slice, CustomStage } from '../store/useAppStore';

type SliceRow = {
  id: string;
  module: 'notes' | 'symbols' | 'theory' | 'patterns';
  content: Record<string, unknown>;
  difficulty: number;
  del_status: boolean;
};

type StageRow = {
  id: string;
  module: 'notes' | 'symbols' | 'theory' | 'patterns';
  title: string;
  is_preset: boolean;
  sort_index: number;
  del_status: boolean;
};

type StageSliceRow = {
  stage_id: string;
  quiz_id: string;
  position: number;
  del_status: boolean;
};

function sliceToRow(slice: Slice): SliceRow {
  return {
    id: slice.id,
    module: slice.module,
    content: slice.content ?? {},
    difficulty: slice.difficulty,
    del_status: false,
  };
}

/** 当前是否登录且有写权限（admin）。无 session 时直接跳过远端写。 */
async function hasWriteSession(): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

/** 把同步失败上报给 store 的统一入口（避免循环依赖：动态 import） */
async function reportSyncError(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[sync:${scope}]`, error);
  try {
    const { useAppStore } = await import('../store/useAppStore');
    useAppStore.setState({ lastSyncError: `${scope}: ${message}` });
  } catch {
    /* store 还没就绪：忽略 */
  }
}

/** 把成功上报给 store 的统一入口 */
async function reportSyncOk() {
  try {
    const { useAppStore } = await import('../store/useAppStore');
    if (useAppStore.getState().lastSyncError !== null) {
      useAppStore.setState({ lastSyncError: null });
    }
  } catch {
    /* store 还没就绪：忽略 */
  }
}

// ============================================================
// Slices
// ============================================================

export async function syncUpsertSlices(slices: Slice[]): Promise<void> {
  if (!supabase || slices.length === 0) return;
  if (!(await hasWriteSession())) return;

  const rows = slices.map(sliceToRow);
  const { error } = await supabase.from('quizzes').upsert(rows as never, { onConflict: 'id' });
  if (error) return reportSyncError('upsert slices', error);
  await reportSyncOk();
}

export async function syncUpdateSliceDifficulty(id: string, difficulty: number): Promise<void> {
  if (!supabase) return;
  if (!(await hasWriteSession())) return;

  const { error } = await supabase
    .from('quizzes')
    .update({ difficulty } as never)
    .eq('id', id);
  if (error) return reportSyncError('update slice difficulty', error);
  await reportSyncOk();
}

export async function syncSoftDeleteSlice(id: string): Promise<void> {
  if (!supabase) return;
  if (!(await hasWriteSession())) return;

  const { error } = await supabase
    .from('quizzes')
    .update({ del_status: true } as never)
    .eq('id', id);
  if (error) return reportSyncError('soft delete slice', error);
  await reportSyncOk();
}

export async function syncSoftDeleteAllSlices(): Promise<void> {
  if (!supabase) return;
  if (!(await hasWriteSession())) return;

  const { error } = await supabase
    .from('quizzes')
    .update({ del_status: true } as never)
    .eq('del_status', false);
  if (error) return reportSyncError('soft delete all slices', error);
  await reportSyncOk();
}

// ============================================================
// Stages
// ============================================================

function stageToRow(stage: CustomStage, sortIndex: number): StageRow {
  return {
    id: stage.id,
    module: stage.module,
    title: stage.title,
    is_preset: Boolean(stage.isPreset),
    sort_index: sortIndex,
    del_status: false,
  };
}

/** 全量同步一个 stage（含其 stage_slices）。新增、改名、改 sliceIds 都走这个。 */
export async function syncUpsertStage(stage: CustomStage, sortIndex: number): Promise<void> {
  if (!supabase) return;
  if (!(await hasWriteSession())) return;

  const { error: stageErr } = await supabase
    .from('stages')
    .upsert([stageToRow(stage, sortIndex)] as never, { onConflict: 'id' });
  if (stageErr) return reportSyncError('upsert stage', stageErr);

  // 重写关联：先标当前列表外的为软删，再 upsert 当前列表
  const currentIds = stage.sliceIds;
  if (currentIds.length > 0) {
    const list = currentIds.map((s) => `"${s}"`).join(',');
    const { error: pruneErr } = await supabase
      .from('stage_quizzes')
      .update({ del_status: true } as never)
      .eq('stage_id', stage.id)
      .eq('del_status', false)
      .not('quiz_id', 'in', `(${list})`);
    if (pruneErr) return reportSyncError('prune stage_slices', pruneErr);

    const rows: StageSliceRow[] = currentIds.map((sliceId, position) => ({
      stage_id: stage.id,
      quiz_id: sliceId,
      position,
      del_status: false,
    }));
    const { error: linkErr } = await supabase
      .from('stage_quizzes')
      .upsert(rows as never, { onConflict: 'stage_id,quiz_id' });
    if (linkErr) return reportSyncError('upsert stage_slices', linkErr);
  } else {
    // 空 sliceIds：把所有当前关联软删
    const { error: pruneErr } = await supabase
      .from('stage_quizzes')
      .update({ del_status: true } as never)
      .eq('stage_id', stage.id)
      .eq('del_status', false);
    if (pruneErr) return reportSyncError('clear stage_slices', pruneErr);
  }

  await reportSyncOk();
}

export async function syncSoftDeleteStage(stageId: string): Promise<void> {
  if (!supabase) return;
  if (!(await hasWriteSession())) return;

  const { error } = await supabase
    .from('stages')
    .update({ del_status: true } as never)
    .eq('id', stageId);
  if (error) return reportSyncError('soft delete stage', error);
  await reportSyncOk();
}

/** 批量重写 module 内 stage 的 sort_index。 */
export async function syncRewriteStageOrder(
  moduleId: string,
  orderedStageIds: string[],
): Promise<void> {
  if (!supabase) return;
  if (!(await hasWriteSession())) return;

  for (let i = 0; i < orderedStageIds.length; i++) {
    const { error } = await supabase
      .from('stages')
      .update({ sort_index: i } as never)
      .eq('id', orderedStageIds[i])
      .eq('module', moduleId);
    if (error) return reportSyncError(`update sort_index[${i}]`, error);
  }
  await reportSyncOk();
}

/** 把 module 下所有 preset 关卡软删。 */
export async function syncSoftDeletePresetStages(moduleId: string): Promise<void> {
  if (!supabase) return;
  if (!(await hasWriteSession())) return;

  const { error } = await supabase
    .from('stages')
    .update({ del_status: true } as never)
    .eq('module', moduleId)
    .eq('is_preset', true)
    .eq('del_status', false);
  if (error) return reportSyncError('soft delete preset stages', error);
  await reportSyncOk();
}

/** 把 stage 从 preset 转为手动。 */
export async function syncUnpresetStage(stageId: string): Promise<void> {
  if (!supabase) return;
  if (!(await hasWriteSession())) return;

  const { error } = await supabase
    .from('stages')
    .update({ is_preset: false } as never)
    .eq('id', stageId);
  if (error) return reportSyncError('unpreset stage', error);
  await reportSyncOk();
}

// ============================================================
// Student: 答题记录 & 进度
// （所有认证用户都可写自己的行；RLS 已配 auth.uid() = user_id）
// ============================================================

/** 记录一次答题到 practice_records；仅已登录学生写入。 */
export async function syncRecordPractice(params: {
  stageId?: string;
  quizId: string;
  module: 'notes' | 'symbols' | 'theory' | 'patterns';
  isCorrect: boolean;
  answeredWrong?: string;
  timeSpentMs?: number;
}): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;

  const row = {
    user_id: data.session.user.id,
    stage_id: params.stageId ?? null,
    quiz_id: params.quizId,
    module: params.module,
    is_correct: params.isCorrect,
    answered_wrong: params.isCorrect ? null : (params.answeredWrong ?? null),
    time_spent_ms: params.timeSpentMs ?? null,
  };
  const { error } = await supabase
    .from('practice_records')
    .insert(row as never);
  if (error) return reportSyncError('record practice', error);
  await reportSyncOk();
}

/**
 * 同步 student_progress 到 Supabase。
 * 仅在已登录时写；RLS 限制 auth.uid() = user_id。
 */
export async function syncUpsertStudentProgress(
  module: string,
  unlocked: number,
): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;

  const { error } = await supabase
    .from('student_progress')
    .upsert(
      { user_id: data.session.user.id, module, unlocked } as never,
      { onConflict: 'user_id,module' },
    );
  if (error) return reportSyncError('upsert student_progress', error);
  await reportSyncOk();
}

/**
 * 一次性迁移：首次登录时从 localStorage 读取 sight-reading-v2-store，
 * 如果 Supabase 中还没任何 student_progress 行，则写入。
 * 幂等：已有数据时跳过。
 */
export async function migrateLocalProgressToSupabase(): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;

  // 检查远端是否已有进度
  const { data: existing, error: checkErr } = await supabase
    .from('student_progress')
    .select('user_id')
    .eq('user_id', data.session.user.id)
    .limit(1);
  if (checkErr) return;
  if (existing && existing.length > 0) return; // 已有数据，跳过

  // 读取 localStorage
  try {
    const raw = localStorage.getItem('sight-reading-v2-store');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const progress = parsed?.state?.studentProgress;
    if (!progress || typeof progress !== 'object') return;

    const modules = ['notes', 'symbols', 'theory', 'patterns'] as const;
    for (const mod of modules) {
      const unlocked = typeof progress[mod] === 'number' ? progress[mod] : 1;
      const { error } = await supabase
        .from('student_progress')
        .upsert(
          { user_id: data.session.user.id, module: mod, unlocked } as never,
          { onConflict: 'user_id,module' },
        );
      if (error) console.warn(`[migrateProgress] ${mod}:`, error.message);
    }
  } catch {
    // localStorage key 不存在或 JSON 损坏 → 忽略
  }
}

/** 记录闯关成功到 test_success_records（UPSERT，每人每关保留最新）。 */
export async function syncRecordTestSuccess(params: {
  stageId: string;
  correctCount: number;
  wrongCount: number;
  timeSpentSec: number;
  score: number;
}): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;

  const { error } = await supabase
    .from('test_success_records')
    .upsert(
      {
        user_id: data.session.user.id,
        stage_id: params.stageId,
        correct_count: params.correctCount,
        wrong_count: params.wrongCount,
        time_spent_sec: params.timeSpentSec,
        score: params.score,
        created_at: new Date().toISOString(),
      } as never,
      { onConflict: 'user_id,stage_id' },
    );
  if (error) return reportSyncError('record test success', error);
  await reportSyncOk();
}
