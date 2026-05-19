/**
 * localStorage → Supabase 数据迁移脚本
 *
 * 用法：
 *   1. 在浏览器 Console（已打开 SightReading 页面后）运行：
 *      copy(JSON.stringify(localStorage.getItem('sight-reading-v2-store')))
 *      这会把整个 localStorage key 复制到剪贴板。
 *
 *   2. 粘贴到一个文件，例如 sightreading-backup.txt：
 *      echo '粘贴的内容' > sightreading-backup.txt
 *
 *   3. 设置环境变量 SUPABASE_SERVICE_ROLE_KEY（从 Supabase Dashboard → Settings → API 获取）：
 *      export SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
 *
 *   4. 运行：
 *      npx tsx scripts/migrate-localstorage-to-supabase.ts sightreading-backup.txt
 *
 * 脚本会：
 *   - 读取 backup 文件，解析 zustand persist 的 JSON
 *   - 逐行 upsert slices / stages / stage_slices 到 Supabase
 *   - 完成后提示清除浏览器 localStorage
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ 缺少环境变量。请设置：');
  console.error('   VITE_SUPABASE_URL=https://your-project.supabase.co');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx  (来自 Supabase Dashboard → Settings → API → service_role key)');
  process.exit(1);
}

const filePath = process.argv[2];
if (!filePath) {
  console.error('❌ 请提供 backup 文件路径：');
  console.error('   npx tsx scripts/migrate-localstorage-to-supabase.ts sightreading-backup.txt');
  process.exit(1);
}

const raw = fs.readFileSync(path.resolve(filePath), 'utf-8').trim();
// 去掉可能的 JSON 外层双引号（如果是从 console 复制的整个 JSON.stringify 结果）
const parsed = JSON.parse(raw.startsWith('"') && raw.endsWith('"') ? JSON.parse(raw) : raw);
const inner = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
if (!inner || !inner.state || !inner.state.slicesPool) {
  console.error('❌ 文件格式不正确：缺少 state.slicesPool。');
  console.error('   请确认是从浏览器 console 运行 copy(JSON.stringify(localStorage.getItem("sight-reading-v2-store"))) 并粘贴完整。');
  process.exit(1);
}

const slices: Array<any> = inner.state.slicesPool ?? [];
const customStages: Array<any> = inner.state.customStages ?? [];
const studentProgress: Record<string, number> = inner.state.studentProgress ?? {};

console.log(`📦 读取到 ${slices.length} 个题目 (slices)、${customStages.length} 个关卡 (stages)`);
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
  // 1. slices
  const sliceRows = slices.map((s: any) => {
    const isA = s.type === 'A';
    const content = s.content ?? {};
    const pitch = isA ? (content.pitch ?? content.raw ?? null) : null;
    const placement = isA ? (content.placement ?? null) : null;
    return {
      id: s.id,
      type: s.type,
      content,
      difficulty: s.difficulty ?? 1,
      pitch: typeof pitch === 'string' ? pitch : null,
      placement: typeof placement === 'string' ? placement : null,
      del_status: false,
      created_at: s.createdAt ? new Date(s.createdAt).toISOString() : undefined,
    };
  });
  if (sliceRows.length > 0) await chunkedUpsert('slices', sliceRows, 'id');

  // 2. stages + stage_slices
  const stageRows: any[] = [];
  const stageSliceRows: any[] = [];
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
      stageSliceRows.push({
        stage_id: cs.id,
        slice_id: sliceId,
        position: pos,
        del_status: false,
      });
    });
  }
  if (stageRows.length > 0) await chunkedUpsert('stages', stageRows, 'id');
  if (stageSliceRows.length > 0) await chunkedUpsert('stage_slices', stageSliceRows, 'stage_id,slice_id');

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
