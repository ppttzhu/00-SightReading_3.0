/**
 * localStorage → Supabase 数据迁移脚本（适配 refactor-quiz-schema + refactor-stats-schema）
 *
 * 用法：
 *   1. 在浏览器 Console 运行：
 *      copy(JSON.stringify(localStorage.getItem('sight-reading-v2-store')))
 *
 *   2. 粘贴到文件：echo '粘贴的内容' > sightreading-backup.txt
 *
 *   3. 设置环境变量后运行：
 *      export SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
 *      npx tsx scripts/migrate-localstorage-to-supabase.ts sightreading-backup.txt
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ 缺少环境变量。请设置：');
  console.error('   VITE_SUPABASE_URL=https://your-project.supabase.co');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx');
  process.exit(1);
}

const filePath = process.argv[2];
if (!filePath) {
  console.error('❌ 请提供 backup 文件路径：');
  console.error('   npx tsx scripts/migrate-localstorage-to-supabase.ts sightreading-backup.txt');
  process.exit(1);
}

const raw = fs.readFileSync(path.resolve(filePath), 'utf-8').trim();
const parsed = JSON.parse(raw.startsWith('"') && raw.endsWith('"') ? JSON.parse(raw) : raw);
const inner = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
if (!inner || !inner.state || !inner.state.slicesPool) {
  console.error('❌ 文件格式不正确：缺少 state.slicesPool。');
  process.exit(1);
}

const slices: Array<any> = inner.state.slicesPool ?? [];
const customStages: Array<any> = inner.state.customStages ?? [];
const studentProgress: Record<string, number> = inner.state.studentProgress ?? {};

const TYPE_TO_MODULE: Record<string, string> = {
  A: 'notes',
  B: 'symbols',
  C: 'theory',
  D: 'patterns',
};

console.log(`📦 读取到 ${slices.length} 个题目、${customStages.length} 个关卡`);
console.log(`   学生进度: ${JSON.stringify(studentProgress)}`);
console.log('');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CHUNK = 500;

async function chunkedUpsert(table: string, rows: any[], onConflict: string) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict } as any);
    if (error) throw new Error(`upsert ${table} [${i}..${i + chunk.length}]: ${error.message}`);
  }
  console.log(`   ✅ ${table}: ${rows.length} 行`);
}

async function main() {
  // 1. quizzes（旧 slices）：type → module，去掉 pitch/placement 独立列
  const quizRows = slices.map((s: any) => {
    const moduleId = TYPE_TO_MODULE[s.type] ?? 'notes';
    return {
      id: s.id,
      module: moduleId,
      content: s.content ?? {},
      difficulty: s.difficulty ?? 1,
      del_status: false,
      created_at: s.createdAt ? new Date(s.createdAt).toISOString() : undefined,
    };
  });
  if (quizRows.length > 0) await chunkedUpsert('quizzes', quizRows, 'id');

  // 2. stages + stage_quizzes
  const stageRows: any[] = [];
  const stageQuizRows: any[] = [];
  for (let sortIdx = 0; sortIdx < customStages.length; sortIdx++) {
    const cs = customStages[sortIdx];
    stageRows.push({
      id: cs.id,
      module: cs.module,
      title: cs.title,
      is_preset: Boolean(cs.isPreset),
      sort_index: sortIdx,
      del_status: false,
    });
    (cs.sliceIds ?? []).forEach((sliceId: string, pos: number) => {
      stageQuizRows.push({
        stage_id: cs.id,
        quiz_id: sliceId,
        position: pos,
        del_status: false,
      });
    });
  }
  if (stageRows.length > 0) await chunkedUpsert('stages', stageRows, 'id');
  if (stageQuizRows.length > 0) await chunkedUpsert('stage_quizzes', stageQuizRows, 'stage_id,quiz_id');

  // 3. student_progress（已有 Supabase 账号时有用）
  const progressRows = Object.entries(studentProgress).map(([module, unlocked]) => ({
    user_id: null, // 需要手动填入目标用户 UUID，或用 service role key 配合用户列表
    module,
    unlocked,
  }));

  if (progressRows.length > 0) {
    console.log(`   ⚠️  student_progress: ${progressRows.length} 行（user_id 为 null，需手动填入目标用户 UUID 后 upsert）`);
    console.log('      如需迁移某个学生的进度，请修改脚本中的 user_id 字段后再运行。');
  }

  console.log('');
  console.log('🎉 迁移完成！');
  console.log('');
  console.log('现在可以在 CMS 页面顶部点「🚀 发布到云端」确认一次全量同步。');
  console.log('之后你可以在浏览器 Console 中执行以下命令清除本地缓存（可选）：');
  console.log('  localStorage.removeItem("sight-reading-v2-store"); location.reload();');
  console.log('');
  console.log('⚠️  清除前请确认：刷新 CMS 页面后数据仍然从 Supabase 加载成功。');
}

main().catch((err) => {
  console.error('❌ 迁移失败：', err);
  process.exit(1);
});
