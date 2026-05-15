import { useState, useRef } from 'react';
import { useAppStore, type CustomStage, type AutoStage } from '../../core/store/useAppStore';

const MODULE_OPTIONS = [
  { value: 'notes',    label: '🎵 单音 (Notes)',          color: '#3b82f6' },
  { value: 'symbols',  label: '🎼 音乐表情记号 (Symbols)', color: '#ec4899' },
  { value: 'theory',   label: '📚 双音/音程关系 (Theory)', color: '#8b5cf6' },
  { value: 'patterns', label: '🎹 音型 (Patterns)',        color: '#10b981' },
] as const;

const TYPE_LABELS: Record<string, string> = { A: '单音', B: '音乐表情记号', C: '双音/音程关系', D: '音型' };
const TYPE_COLORS: Record<string, string> = { A: '#3b82f6', B: '#ec4899', C: '#8b5cf6', D: '#10b981' };
const MODULE_TYPE: Record<string, string> = {
  notes: 'A', symbols: 'B', theory: 'C', patterns: 'D',
};

export default function CustomStageEditor() {
  const slicesPool = useAppStore(s => s.slicesPool);
  const customStages = useAppStore(s => s.customStages);
  const stageOrder = useAppStore(s => s.stageOrder);
  const addCustomStage = useAppStore(s => s.addCustomStage);
  const updateCustomStage = useAppStore(s => s.updateCustomStage);
  const removeCustomStage = useAppStore(s => s.removeCustomStage);
  const generatePresetStages = useAppStore(s => s.generatePresetStages);
  const setStageOrder = useAppStore(s => s.setStageOrder);
  const getAllStages = useAppStore(s => s.getAllStages);

  const [module, setModule] = useState<'notes' | 'symbols' | 'theory' | 'patterns'>('notes');
  const [stageName, setStageName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [diffFilter, setDiffFilter] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomStage | null>(null);
  const [msg, setMsg] = useState('');
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  const relevantType = MODULE_TYPE[module];
  const usedByOthers = new Set(
    customStages.filter(cs => cs.id !== editingId).flatMap(cs => cs.sliceIds)
  );
  const filteredPool = slicesPool.filter(s => s.type === relevantType && !usedByOthers.has(s.id));
  const visiblePool = filteredPool.filter(s => diffFilter === null || s.difficulty === diffFilter);
  const moduleStages = customStages.filter(cs => cs.module === module && !cs.isPreset);
  const moduleColor = MODULE_OPTIONS.find(m => m.value === module)?.color || '#3b82f6';
  const hasOrder = stageOrder[module] && stageOrder[module].length > 0;
  const orderedStages: AutoStage[] = hasOrder ? getAllStages(module) : [];

  const handleDragStart = (idx: number) => { dragItem.current = idx; };
  const handleDragEnter = (idx: number) => { dragOver.current = idx; };
  const handleDragEnd = () => {
    if (dragItem.current === null || dragOver.current === null || dragItem.current === dragOver.current) return;
    const newOrder = [...stageOrder[module]];
    const [moved] = newOrder.splice(dragItem.current, 1);
    newOrder.splice(dragOver.current, 0, moved);
    setStageOrder(module, newOrder);
    dragItem.current = null;
    dragOver.current = null;
  };

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
    setDiffFilter(null);
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
    <>
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
                onClick={() => setSelectedIds(selectedIds.size === visiblePool.length ? new Set() : new Set(visiblePool.map(s => s.id)))}
                style={{ fontSize: '0.8rem', color: moduleColor, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                {selectedIds.size === visiblePool.length && visiblePool.length > 0 ? '取消全选' : '全选'}
              </button>
            )}
          </div>

          {/* 难度筛选 */}
          {filteredPool.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <button onClick={() => { setDiffFilter(null); setSelectedIds(new Set()); }} style={{ padding: '3px 10px', borderRadius: '20px', border: `1px solid ${diffFilter === null ? moduleColor : '#e5e7eb'}`, background: diffFilter === null ? `${moduleColor}18` : 'white', color: diffFilter === null ? moduleColor : '#6b7280', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>全部</button>
              {Array.from(new Set(filteredPool.map(s => s.difficulty))).sort((a, b) => a - b).map(d => (
                <button key={d} onClick={() => { setDiffFilter(diffFilter === d ? null : d); setSelectedIds(new Set()); }} style={{ padding: '3px 10px', borderRadius: '20px', border: `1px solid ${diffFilter === d ? '#f59e0b' : '#e5e7eb'}`, background: diffFilter === d ? '#fef3c7' : 'white', color: diffFilter === d ? '#d97706' : '#6b7280', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>L{d}</button>
              ))}
            </div>
          )}

          {filteredPool.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', background: '#f9fafb', borderRadius: '10px', color: '#9ca3af' }}>
              该模块题库为空，请先通过「手动出题器」添加题目
            </div>
          ) : (
            <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '8px' }}>
              {visiblePool.map(slice => {
                const checked = selectedIds.has(slice.id);
                const c = slice.content;
                const label = (typeof c === 'string' ? c : c.raw || c.symbol || c.theory || c.pattern) || slice.id;
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

      {/* ===== 全局排序区块 ===== */}
      <div style={{ background: 'white', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', marginBottom: '32px', border: '2px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#374151', fontWeight: 700 }}>关卡排序（学生视角）</h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#9ca3af' }}>
              {hasOrder ? '拖拽调整关卡顺序，学生将按此顺序解锁关卡' : '点击「生成预设关卡」后可在此拖拽排序'}
            </p>
          </div>
          <button
            onClick={() => { generatePresetStages(module); showMsg('✓ 预设关卡已重新生成'); }}
            style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#6366f1', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', whiteSpace: 'nowrap' }}
          >
            生成预设关卡
          </button>
        </div>

        {hasOrder ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 16px', fontSize: '0.78rem', color: '#9ca3af', fontWeight: 600 }}>
              <span style={{ width: '16px' }} />
              <span style={{ width: '28px', textAlign: 'center' }}>序号</span>
              <span style={{ flex: 1 }}>关卡名称</span>
              <span style={{ width: '36px', textAlign: 'center' }}>类型</span>
              <span style={{ width: '36px', textAlign: 'right' }}>题数</span>
            </div>
            {orderedStages.map((stage, idx) => {
              const isPreset = customStages.find(cs => cs.id === stage.id)?.isPreset;
              return (
                <div
                  key={stage.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragEnter={() => handleDragEnter(idx)}
                  onDragEnd={handleDragEnd}
                  onDragOver={e => e.preventDefault()}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fafafa', cursor: 'grab', userSelect: 'none' }}
                >
                  <span style={{ color: '#9ca3af', fontSize: '1rem' }}>⠿</span>
                  <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: `${moduleColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: moduleColor, fontWeight: 800, fontSize: '0.85rem', flexShrink: 0 }}>{idx + 1}</span>
                  <span style={{ flex: 1, fontWeight: 600, color: '#1f2937', fontSize: '0.95rem' }}>{stage.title}</span>
                  <span style={{ fontSize: '0.78rem', padding: '2px 8px', borderRadius: '4px', background: isPreset ? '#f3f4f6' : `${moduleColor}18`, color: isPreset ? '#9ca3af' : moduleColor, fontWeight: 600 }}>
                    {isPreset ? '预设' : '手动'}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{stage.slices.length} 题</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: '32px', textAlign: 'center', background: '#f9fafb', borderRadius: '10px', color: '#9ca3af' }}>
            暂无排序数据，点击「生成预设关卡」初始化
          </div>
        )}
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
              const isExpanded = expandedId === cs.id;
              const stageSlices = cs.sliceIds.map(id => slicesPool.find(s => s.id === id)).filter(Boolean) as typeof slicesPool;
              return (
                <div key={cs.id} style={{ borderRadius: '10px', border: `1px solid ${editingId === cs.id ? '#f59e0b' : '#e5e7eb'}`, borderLeft: `4px solid ${moduleColor}`, background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 18px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: `${moduleColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: moduleColor, fontWeight: 800, fontSize: '0.9rem', flexShrink: 0 }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: '#1f2937', marginBottom: '2px' }}>{cs.title}</div>
                      <div style={{ fontSize: '0.82rem', color: '#9ca3af' }}>{sliceCount} 道题</div>
                    </div>
                    <button onClick={() => setExpandedId(isExpanded ? null : cs.id)} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #d1d5db', background: isExpanded ? '#f3f4f6' : 'white', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                      {isExpanded ? '收起' : '查看'}
                    </button>
                    <button onClick={() => handleEdit(cs)} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                      编辑
                    </button>
                    <button onClick={() => setDeleteTarget(cs)} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: '#fee2e2', color: '#ef4444', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                      删除
                    </button>
                  </div>
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {stageSlices.map(slice => {
                        const c = slice.content;
                        const label = (typeof c === 'string' ? c : c.raw || c.symbol || c.theory || c.pattern) || slice.id;
                        return (
                          <div key={slice.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#374151' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '4px', background: `${TYPE_COLORS[slice.type]}18`, color: TYPE_COLORS[slice.type], fontWeight: 600, fontSize: '0.75rem' }}>{TYPE_LABELS[slice.type]}</span>
                            <span style={{ flex: 1 }}>{label}</span>
                            <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>L{slice.difficulty}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>

    {deleteTarget && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '28px 32px', width: '360px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
          <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1f2937', marginBottom: '10px' }}>删除关卡</div>
          <div style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '24px' }}>确认删除关卡「{deleteTarget.title}」？此操作不可撤销。</div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button onClick={() => setDeleteTarget(null)} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer' }}>取消</button>
            <button onClick={() => { removeCustomStage(deleteTarget.id); setDeleteTarget(null); }} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#ef4444', color: 'white', fontWeight: 600, cursor: 'pointer' }}>删除</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
