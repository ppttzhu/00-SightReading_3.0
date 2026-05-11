import { useState } from 'react';
import { useAppStore, type CustomStage } from '../../core/store/useAppStore';

const MODULE_OPTIONS = [
  { value: 'notes',    label: '🎵 单音识谱 (Notes)',    color: '#3b82f6' },
  { value: 'symbols',  label: '🎼 音乐记号 (Symbols)',  color: '#ec4899' },
  { value: 'theory',   label: '📚 乐理知识 (Theory)',   color: '#8b5cf6' },
  { value: 'patterns', label: '🎹 音型练习 (Patterns)', color: '#10b981' },
] as const;

const TYPE_LABELS: Record<string, string> = { A: '单音', B: '符号', C: '乐理', D: '音型' };
const TYPE_COLORS: Record<string, string> = { A: '#3b82f6', B: '#ec4899', C: '#8b5cf6', D: '#10b981' };
const MODULE_TYPE: Record<string, string> = {
  notes: 'A', symbols: 'B', theory: 'C', patterns: 'D',
};

export default function CustomStageEditor() {
  const slicesPool = useAppStore(s => s.slicesPool);
  const customStages = useAppStore(s => s.customStages);
  const addCustomStage = useAppStore(s => s.addCustomStage);
  const updateCustomStage = useAppStore(s => s.updateCustomStage);
  const removeCustomStage = useAppStore(s => s.removeCustomStage);

  const [module, setModule] = useState<'notes' | 'symbols' | 'theory' | 'patterns'>('notes');
  const [stageName, setStageName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const relevantType = MODULE_TYPE[module];
  const filteredPool = slicesPool.filter(s => s.type === relevantType);
  const moduleStages = customStages.filter(cs => cs.module === module);
  const moduleColor = MODULE_OPTIONS.find(m => m.value === module)?.color || '#3b82f6';

  const showMsg = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 2500);
  };

  const toggleSlice = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCreate = () => {
    if (!stageName.trim()) return showMsg('请输入关卡名称');
    if (selectedIds.size === 0) return showMsg('至少选择 1 道题目');
    const stage: CustomStage = {
      id: `custom_${Date.now()}`,
      module,
      title: stageName.trim(),
      sliceIds: Array.from(selectedIds),
    };
    addCustomStage(stage);
    setStageName('');
    setSelectedIds(new Set());
    showMsg(`✓ 已创建关卡「${stage.title}」（${stage.sliceIds.length} 道题）`);
  };

  const handleEdit = (cs: CustomStage) => {
    setEditingId(cs.id);
    setStageName(cs.title);
    setSelectedIds(new Set(cs.sliceIds));
    setModule(cs.module);
  };

  const handleUpdate = () => {
    if (!editingId) return;
    if (!stageName.trim()) return showMsg('请输入关卡名称');
    if (selectedIds.size === 0) return showMsg('至少选择 1 道题目');
    updateCustomStage(editingId, { title: stageName.trim(), sliceIds: Array.from(selectedIds) });
    setEditingId(null);
    setStageName('');
    setSelectedIds(new Set());
    showMsg('✓ 关卡已更新');
  };

  const handleCancel = () => {
    setEditingId(null);
    setStageName('');
    setSelectedIds(new Set());
  };

  return (
    <div style={{ maxWidth: '900px' }}>
      <h1 style={{ fontSize: '2rem', color: '#1f2937', margin: '0 0 8px' }}>关卡编排</h1>
      <p style={{ color: '#6b7280', marginBottom: '28px' }}>
        自定义每个关卡的题目内容与顺序，学生端将在自动生成关卡之后看到这些手动关卡。
      </p>

      {/* 成功提示 */}
      {msg && (
        <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: '8px', padding: '10px 18px', color: '#065f46', fontWeight: 600, marginBottom: '20px' }}>
          {msg}
        </div>
      )}

      {/* ===== 创建 / 编辑区 ===== */}
      <div style={{ background: 'white', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', marginBottom: '32px', border: `2px solid ${editingId ? '#f59e0b' : moduleColor}20` }}>
        <h2 style={{ margin: '0 0 20px', fontSize: '1.15rem', color: '#374151', fontWeight: 700 }}>
          {editingId ? '✏️ 编辑关卡' : '➕ 新建关卡'}
        </h2>

        {/* 模块选择 */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>所属模块</label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {MODULE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { if (!editingId) { setModule(opt.value); setSelectedIds(new Set()); } }}
                style={{
                  padding: '8px 16px', borderRadius: '20px', border: 'none',
                  background: module === opt.value ? opt.color : '#f3f4f6',
                  color: module === opt.value ? 'white' : '#6b7280',
                  fontWeight: 600, cursor: editingId ? 'not-allowed' : 'pointer',
                  fontSize: '0.88rem', opacity: editingId && module !== opt.value ? 0.4 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 关卡名称 */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>关卡名称</label>
          <input
            type="text"
            value={stageName}
            onChange={e => setStageName(e.target.value)}
            placeholder="例如：基础单音识别、升降号练习..."
            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '1rem', boxSizing: 'border-box' }}
          />
        </div>

        {/* 题目勾选 */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <label style={{ fontWeight: 600, color: '#374151', fontSize: '0.9rem' }}>
              选择题目 <span style={{ color: '#9ca3af', fontWeight: 400 }}>（已选 {selectedIds.size} 道）</span>
            </label>
            {filteredPool.length > 0 && (
              <button
                onClick={() => setSelectedIds(selectedIds.size === filteredPool.length ? new Set() : new Set(filteredPool.map(s => s.id)))}
                style={{ fontSize: '0.8rem', color: moduleColor, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                {selectedIds.size === filteredPool.length ? '取消全选' : '全选'}
              </button>
            )}
          </div>

          {filteredPool.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', background: '#f9fafb', borderRadius: '10px', color: '#9ca3af' }}>
              该模块题库为空，请先通过「手动出题器」添加题目
            </div>
          ) : (
            <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '8px' }}>
              {filteredPool.map(slice => {
                const checked = selectedIds.has(slice.id);
                const label = slice.content.raw || slice.content.symbol || slice.content.theory || slice.content.pattern || slice.id;
                return (
                  <label
                    key={slice.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '9px 12px', borderRadius: '8px', cursor: 'pointer',
                      background: checked ? `${moduleColor}10` : 'transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSlice(slice.id)}
                      style={{ accentColor: moduleColor, width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: '4px',
                      background: `${TYPE_COLORS[slice.type]}18`, color: TYPE_COLORS[slice.type],
                      fontSize: '0.75rem', fontWeight: 700, flexShrink: 0
                    }}>
                      {TYPE_LABELS[slice.type]}
                    </span>
                    <span style={{ color: '#374151', fontSize: '0.95rem' }}>{label}</span>
                    <span style={{ marginLeft: 'auto', color: '#f59e0b', fontSize: '0.8rem', flexShrink: 0 }}>L{slice.difficulty}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {editingId ? (
            <>
              <button
                onClick={handleUpdate}
                style={{ padding: '10px 28px', borderRadius: '8px', border: 'none', background: '#f59e0b', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}
              >
                保存修改
              </button>
              <button
                onClick={handleCancel}
                style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem' }}
              >
                取消
              </button>
            </>
          ) : (
            <button
              onClick={handleCreate}
              style={{ padding: '10px 28px', borderRadius: '8px', border: 'none', background: moduleColor, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}
            >
              创建关卡
            </button>
          )}
        </div>
      </div>

      {/* ===== 已创建的自定义关卡（按当前模块筛选） ===== */}
      <div>
        <h2 style={{ fontSize: '1.15rem', color: '#374151', fontWeight: 700, marginBottom: '14px' }}>
          当前模块的手动关卡
          <span style={{ marginLeft: '10px', fontSize: '0.85rem', color: '#9ca3af', fontWeight: 400 }}>
            （共 {moduleStages.length} 个）
          </span>
        </h2>

        {moduleStages.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', background: '#f9fafb', borderRadius: '12px', color: '#9ca3af' }}>
            暂无手动关卡，点击上方「创建关卡」按钮开始编排
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {moduleStages.map((cs, idx) => {
              const sliceCount = cs.sliceIds.length;
              const resolved = cs.sliceIds.filter(id => slicesPool.some(s => s.id === id)).length;
              return (
                <div
                  key={cs.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '16px',
                    padding: '14px 18px', background: 'white', borderRadius: '10px',
                    border: `1px solid ${editingId === cs.id ? '#f59e0b' : '#e5e7eb'}`,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                    borderLeft: `4px solid ${moduleColor}`,
                  }}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: `${moduleColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: moduleColor, fontWeight: 800, fontSize: '0.9rem', flexShrink: 0 }}>
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#1f2937', marginBottom: '2px' }}>{cs.title}</div>
                    <div style={{ fontSize: '0.82rem', color: '#9ca3af' }}>
                      {resolved} / {sliceCount} 道题
                      {resolved < sliceCount && <span style={{ color: '#ef4444', marginLeft: '6px' }}>（有 {sliceCount - resolved} 道题目已从题库删除）</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleEdit(cs)}
                    style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => { if (confirm(`确认删除关卡「${cs.title}」？`)) removeCustomStage(cs.id); }}
                    style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: '#fee2e2', color: '#ef4444', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    删除
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
