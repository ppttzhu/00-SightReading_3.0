import { useState } from 'react';
import { useAppStore, areSlicesDuplicate } from '../../core/store/useAppStore';
import type { Slice } from '../../core/store/useAppStore';
import { getStaffLabel } from '../../core/engine/pitchUtils';

const TYPE_LABELS: Record<string, string> = {
  notes: '单音', symbols: '音乐表情记号', theory: '双音/音程关系', patterns: '音型',
};
const TYPE_COLORS: Record<string, string> = {
  notes: '#3b82f6', symbols: '#ec4899', theory: '#8b5cf6', patterns: '#10b981',
};

// ── 清空确认 Modal ────────────────────────────────────────────
function ClearConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const [input, setInput] = useState('');
  const confirmed = input === '确定删除';
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '12px', padding: '32px', width: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h2 style={{ margin: '0 0 8px', color: '#1f2937', fontSize: '1.2rem' }}>确认清空题库</h2>
        <p style={{ color: '#6b7280', margin: '0 0 20px', fontSize: '0.9rem' }}>此操作将删除全部题目且不可恢复。请输入 <b>确定删除</b> 以确认。</p>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="确定删除"
          style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', color: '#374151' }}>取消</button>
          <button onClick={onConfirm} disabled={!confirmed}
            style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: confirmed ? '#ef4444' : '#fca5a5', color: 'white', cursor: confirmed ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>
            确定删除
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 编辑 Modal ────────────────────────────────────────────────
function EditModal({ slice, allSlices, onSave, onCancel }: {
  slice: Slice;
  allSlices: Slice[];
  onSave: (patch: Partial<Slice>) => void;
  onCancel: () => void;
}) {
  const c = slice.content as unknown as Record<string, unknown>;

  const [theory, setTheory] = useState((c.theory as string) || '');
  const [noteA, setNoteA] = useState((c.noteA as string) || '');
  const [noteB, setNoteB] = useState((c.noteB as string) || '');
  const [answer, setAnswer] = useState((c.answer as string) || '');
  const [options, setOptions] = useState(((c.options as string[]) || []).join('|'));
  const [difficulty, setDifficulty] = useState(slice.difficulty);
  const [error, setError] = useState('');

  const handleSave = () => {
    const opts = options.split('|').map(s => s.trim()).filter(Boolean);
    let newContent: Record<string, unknown>;

    if (slice.module === 'theory') {
      const raw = `${noteA.trim()},${noteB.trim()}|${theory.trim()}`;
      newContent = { ...c, noteA: noteA.trim(), noteB: noteB.trim(), theory: theory.trim(), raw, ...(opts.length > 0 && { options: opts }) };
    } else if (slice.module === 'symbols') {
      newContent = { ...c, answer: answer.trim(), ...(opts.length > 0 && { options: opts }) };
    } else {
      newContent = { ...c, ...(opts.length > 0 && { options: opts }) };
    }

    const candidate = { ...slice, content: newContent as unknown as Slice['content'], difficulty };
    const duplicate = allSlices.some(s => s.id !== slice.id && areSlicesDuplicate(s, candidate));
    if (duplicate) { setError('与题库中已有题目重复，请修改后再保存。'); return; }

    onSave({ content: newContent as unknown as Slice['content'], difficulty });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', border: '1px solid #d1d5db',
    borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '12px', padding: '28px', width: '480px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#1f2937' }}>编辑题目 — {TYPE_LABELS[slice.module]}</h2>

        {slice.module === 'theory' && (
          <>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8rem', color: '#6b7280' }}>音A</label>
                <input value={noteA} onChange={e => setNoteA(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8rem', color: '#6b7280' }}>音B</label>
                <input value={noteB} onChange={e => setNoteB(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#6b7280' }}>答案（音程名/方向/级进跳进等）</label>
              <input value={theory} onChange={e => setTheory(e.target.value)} style={inputStyle} />
            </div>
          </>
        )}

        {slice.module === 'symbols' && (
          <div>
            <label style={{ fontSize: '0.8rem', color: '#6b7280' }}>正确答案</label>
            <input value={answer} onChange={e => setAnswer(e.target.value)} style={inputStyle} />
          </div>
        )}

        <div>
          <label style={{ fontSize: '0.8rem', color: '#6b7280' }}>所有选项（含正确答案，用 | 分隔，留空则随机生成）</label>
          <input value={options} onChange={e => setOptions(e.target.value)}
            placeholder="如：纯五度 (P5)|大五度|小五度|增五度" style={inputStyle} />
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', color: '#6b7280' }}>难度 L{difficulty}</label>
          <input type="range" min={1} max={10} value={difficulty} onChange={e => setDifficulty(+e.target.value)} style={{ width: '100%' }} />
        </div>

        {error && <p style={{ margin: 0, color: '#ef4444', fontSize: '0.85rem' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', color: '#374151' }}>取消</button>
          <button onClick={handleSave} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>保存</button>
        </div>
      </div>
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────────
export default function StageBuilder() {
  const slicesPool = useAppStore(state => state.slicesPool);
  const customStages = useAppStore(state => state.customStages);
  const updateSliceDifficulty = useAppStore(state => state.updateSliceDifficulty);
  const updateSlice = useAppStore(state => state.updateSlice);
  const removeSlice = useAppStore(state => state.removeSlice);
  const clearPool = useAppStore(state => state.clearPool);

  const [showClearModal, setShowClearModal] = useState(false);
  const [filterType, setFilterType] = useState<string>('notes');
  const [editingSlice, setEditingSlice] = useState<Slice | null>(null);
  const [search, setSearch] = useState('');

  const stats = {
    notes:    slicesPool.filter(s => s.module === 'notes').length,
    symbols:  slicesPool.filter(s => s.module === 'symbols').length,
    theory:   slicesPool.filter(s => s.module === 'theory').length,
    patterns: slicesPool.filter(s => s.module === 'patterns').length,
  };

  // slice.id → 所属关卡标题列表
  const sliceStageMap = new Map<string, string[]>();
  customStages.forEach(cs => {
    cs.sliceIds.forEach(sid => {
      if (!sliceStageMap.has(sid)) sliceStageMap.set(sid, []);
      sliceStageMap.get(sid)!.push(cs.title);
    });
  });

  return (
    <>
      <div style={{ maxWidth: '900px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', color: '#1f2937', margin: 0 }}>题库管理</h1>
            <p style={{ color: '#6b7280', marginTop: '8px' }}>系统将根据题库自动按难度和分类生成关卡，每关 5 道题。</p>
          </div>
          {slicesPool.length > 0 && (
            <button onClick={() => setShowClearModal(true)}
              style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              清空题库
            </button>
          )}
        </div>

        {/* 统计卡片 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '20px' }}>
          {(['notes', 'symbols', 'theory', 'patterns'] as const).map(type => {
            const active = filterType === type;
            return (
              <div key={type} onClick={() => { setFilterType(type); setSearch(''); }} style={{
                padding: '20px', borderRadius: '12px', background: 'white', cursor: 'pointer',
                border: active ? `2px solid ${TYPE_COLORS[type]}` : `1px solid ${TYPE_COLORS[type]}20`,
                boxShadow: active ? `0 4px 16px ${TYPE_COLORS[type]}30` : '0 2px 8px rgba(0,0,0,0.03)',
                transform: active ? 'scale(1.03)' : 'scale(1)', transition: 'all 0.2s',
              }}>
                <div style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '8px' }}>{TYPE_LABELS[type]}池</div>
                <div style={{ fontSize: '2rem', fontWeight: '800', color: TYPE_COLORS[type] }}>{stats[type]}</div>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>→ {Math.ceil(stats[type] / 5)} 关</div>
              </div>
            );
          })}
        </div>

        <div style={{ marginBottom: '20px' }}>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); }}
            placeholder={`搜索${TYPE_LABELS[filterType]}题目标题…`}
            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box' }}
          />
        </div>

        {/* 题目列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {slicesPool.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', background: '#f9fafb', borderRadius: '12px' }}>
              题库为空。请通过"文件解析器"或"手动出题器"添加题目。
            </div>
          ) : (
            slicesPool
              .filter(slice => slice.module === filterType)
              .filter(slice => {
                if (!search.trim()) return true;
                const c = slice.content as unknown as Record<string, unknown>;
                const label = String(c.raw || c.symbol || c.theory || c.pattern || '');
                return label.toLowerCase().includes(search.toLowerCase());
              })
              .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
              .map(slice => {
                const c = slice.content as unknown as Record<string, unknown>;
                const label = String(c.raw || c.symbol || c.theory || c.pattern || '');
                const isNew = (slice.createdAt || 0) > Date.now() - 10 * 60 * 1000;
                const stageNames = sliceStageMap.get(slice.id);
                const opts = c.options as string[] | undefined;

                return (
                  <div key={slice.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    padding: '12px 16px', background: 'white',
                    borderLeft: `4px solid ${TYPE_COLORS[slice.module]}`,
                    borderRadius: '6px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)', gap: '12px',
                  }}>
                    {/* 左侧信息 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ background: `${TYPE_COLORS[slice.module]}15`, color: TYPE_COLORS[slice.module], padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', flexShrink: 0 }}>
                          {TYPE_LABELS[slice.module]}
                        </span>
                        <span style={{ color: '#1f2937', fontWeight: '500' }}>{label}</span>
                        {slice.module === 'notes' && (
                          <span style={{ padding: '1px 6px', borderRadius: '4px', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: '0.75rem', flexShrink: 0 }}>
                            {getStaffLabel(c.pitch as string || c.raw as string, (c.placement as 'auto' | 'treble' | 'bass') || undefined)}
                          </span>
                        )}
                        {slice.module === 'theory' && (c.placement as string) && (
                          <span style={{ padding: '1px 6px', borderRadius: '4px', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: '0.75rem', flexShrink: 0 }}>
                            {(c.placement as string) === 'treble' ? '高音' : (c.placement as string) === 'bass' ? '低音' : '自动'}
                          </span>
                        )}
                        {isNew && (
                          <span style={{ padding: '1px 6px', borderRadius: '4px', background: '#fee2e2', color: '#ef4444', fontSize: '0.7rem', fontWeight: 'bold', flexShrink: 0 }}>新</span>
                        )}
                      </div>

                      {/* 指定选项 */}
                      {opts && opts.length > 0 && (
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                          选项: {opts.join(' / ')}
                        </span>
                      )}

                      {/* 所属关卡 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>关卡:</span>
                        {stageNames && stageNames.length > 0 ? stageNames.map(name => (
                          <span key={name} style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: '4px', background: '#f3f4f6', color: '#6b7280' }}>{name}</span>
                        )) : (
                          <span style={{ fontSize: '0.72rem', color: '#d1d5db' }}>未编排</span>
                        )}
                      </div>
                    </div>

                    {/* 右侧操作 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', background: '#fef3c7', borderRadius: '6px', padding: '2px 4px' }}>
                        <button onClick={() => updateSliceDifficulty(slice.id, -1)} style={{ background: 'transparent', border: 'none', color: '#d97706', cursor: 'pointer', fontWeight: 'bold', padding: '0 6px' }}>−</button>
                        <span style={{ fontSize: '0.8rem', color: '#b45309', fontWeight: 'bold', minWidth: '36px', textAlign: 'center' }}>L{slice.difficulty}</span>
                        <button onClick={() => updateSliceDifficulty(slice.id, 1)} style={{ background: 'transparent', border: 'none', color: '#d97706', cursor: 'pointer', fontWeight: 'bold', padding: '0 6px' }}>+</button>
                      </div>
                      <button onClick={() => setEditingSlice(slice)}
                        style={{ background: '#eff6ff', color: '#3b82f6', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                        编辑
                      </button>
                      <button onClick={() => removeSlice(slice.id)}
                        style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                        删除
                      </button>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>

      {showClearModal && (
        <ClearConfirmModal
          onConfirm={() => { clearPool(); setShowClearModal(false); }}
          onCancel={() => setShowClearModal(false)}
        />
      )}

      {editingSlice && (
        <EditModal
          slice={editingSlice}
          allSlices={slicesPool}
          onSave={(patch) => { updateSlice(editingSlice.id, patch); setEditingSlice(null); }}
          onCancel={() => setEditingSlice(null)}
        />
      )}
    </>
  );
}
