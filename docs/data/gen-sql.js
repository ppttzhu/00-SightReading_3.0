const fs = require('fs');
const data = JSON.parse(fs.readFileSync('docs/data/data.json', 'utf-8'));
const slices = data.state.slicesPool || [];
const stages = data.state.customStages || [];
const progress = data.state.studentProgress || {};

const TYPE_TO_MODULE = { A: 'notes', B: 'symbols', C: 'theory', D: 'patterns' };

let out = '';

// 1. quizzes INSERT
out += '-- ============================================================\n';
out += '-- 1. quizzes (题目素材)\n';
out += '-- ============================================================\n';
for (const s of slices) {
  const module = TYPE_TO_MODULE[s.type] || 'notes';
  const content = JSON.stringify(s.content || {}).replace(/'/g, "''");
  out += `INSERT INTO public.quizzes (id, module, content, difficulty, del_status) VALUES ('${s.id}', '${module}', '${content}'::jsonb, ${s.difficulty || 1}, false) ON CONFLICT (id) DO UPDATE SET module = EXCLUDED.module, content = EXCLUDED.content, difficulty = EXCLUDED.difficulty;\n`;
}

// 2. stages INSERT
out += '\n-- ============================================================\n';
out += '-- 2. stages (关卡)\n';
out += '-- ============================================================\n';
for (let i = 0; i < stages.length; i++) {
  const cs = stages[i];
  out += `INSERT INTO public.stages (id, module, title, is_preset, sort_index, del_status) VALUES ('${cs.id}', '${cs.module}', '${cs.title.replace(/'/g, "''")}', ${cs.isPreset || false}, ${i}, false) ON CONFLICT (id) DO UPDATE SET module = EXCLUDED.module, title = EXCLUDED.title, is_preset = EXCLUDED.is_preset, sort_index = EXCLUDED.sort_index;\n`;
}

// 3. stage_quizzes INSERT
out += '\n-- ============================================================\n';
out += '-- 3. stage_quizzes (关卡-题目关联)\n';
out += '-- ============================================================\n';
for (const cs of stages) {
  (cs.sliceIds || []).forEach((sid, pos) => {
    out += `INSERT INTO public.stage_quizzes (stage_id, quiz_id, position, del_status) VALUES ('${cs.id}', '${sid}', ${pos}, false) ON CONFLICT (stage_id, quiz_id) DO UPDATE SET position = EXCLUDED.position;\n`;
  });
}

// 4. student_progress
out += '\n-- ============================================================\n';
out += '-- 4. student_progress（如需迁移，手动填入 user_id 后执行）\n';
out += '-- ============================================================\n';
out += '-- 请先替换下面 YOUR_USER_ID 为实际用户 UUID\n';
for (const [mod, unlocked] of Object.entries(progress)) {
  out += `-- INSERT INTO public.student_progress (user_id, module, unlocked) VALUES ('YOUR_USER_ID', '${mod}', ${unlocked}) ON CONFLICT (user_id, module) DO UPDATE SET unlocked = EXCLUDED.unlocked;\n`;
}

fs.writeFileSync('docs/data/migration.sql', out);
console.log(`Generated docs/data/migration.sql with ${slices.length} quizzes, ${stages.length} stages`);
