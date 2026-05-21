import { useState } from 'react';
import { useAppStore } from '../../core/store/useAppStore';
import { getStaffLabel } from '../../core/engine/pitchUtils';

function ClearConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const [input, setInput] = useState('');
  const confirmed = input === '确定删除';
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '12px', padding: '32px', width: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h2 style={{ margin: '0 0 8px', color: '#1f2937', fontSize: '1.2rem' }}>确认清空题库</h2>
        <p style={{ color: '#6b7280', margin: '0 0 20px', fontSize: '0.9rem' }}>此操作将删除全部题目且不可恢复。请在下方输入框中输入 <b>确定删除</b> 以确认。</p>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="确定删除"
          style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box', outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', color: '#374151' }}>取消</button>
          <button
            onClick={onConfirm}
            disabled={!confirmed}
            style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: confirmed ? '#ef4444' : '#fca5a5', color: 'white', cursor: confirmed ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}
          >确定删除</button>
        </div>
      </div>
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  'notes': '单音',
  'symbols': '音乐表情记号',
  'theory': '双音/音程关系',
  'patterns': '音型',
};

const TYPE_COLORS: Record<string, string> = {
  'notes': '#3b82f6',
  'symbols': '#ec4899',
  'theory': '#8b5cf6',
  'patterns': '#10b981',
};

export default function StageBuilder() {
  const slicesPool = useAppStore(state => state.slicesPool);
  const updateSliceDifficulty = useAppStore(state => state.updateSliceDifficulty);
  const removeSlice = useAppStore(state => state.removeSlice);
  const clearPool = useAppStore(state => state.clearPool);
  const [showClearModal, setShowClearModal] = useState(false);
  const [filterType, setFilterType] = useState<string>('notes');

  // 按模块分组统计
  const stats = {
    notes:    slicesPool.filter(s => s.module === 'notes').length,
    symbols:  slicesPool.filter(s => s.module === 'symbols').length,
    theory:   slicesPool.filter(s => s.module === 'theory').length,
    patterns: slicesPool.filter(s => s.module === 'patterns').length,
  };

  const filteredCount = stats[filterType as keyof typeof stats] ?? 0;
  const filteredStages = Math.ceil(filteredCount / 5);

  return (
    <>
    <div style={{ maxWidth: '900px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', color: '#1f2937', margin: 0 }}>题库管理</h1>
          <p style={{ color: '#6b7280', marginTop: '8px' }}>
            系统将根据题库自动按难度和分类生成关卡，每关 5 道题。
          </p>
        </div>
        {slicesPool.length > 0 && (
          <button
            onClick={() => setShowClearModal(true)}
            style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            清空题库
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>点击卡片切换题库类型</span>
      </div>

      {/* 统计卡片（也是筛选器） */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '20px' }}>
        {(['notes', 'symbols', 'theory', 'patterns'] as const).map(type => {
          const active = filterType === type;
          return (
            <div
              key={type}
              onClick={() => setFilterType(type)}
              style={{
                padding: '20px',
                borderRadius: '12px',
                background: 'white',
                border: active ? `2px solid ${TYPE_COLORS[type]}` : `1px solid ${TYPE_COLORS[type]}20`,
                boxShadow: active ? `0 4px 16px ${TYPE_COLORS[type]}30` : '0 2px 8px rgba(0,0,0,0.03)',
                transform: active ? 'scale(1.03)' : 'scale(1)',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
              }}
            >
              <div style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '8px' }}>{TYPE_LABELS[type]}池</div>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: TYPE_COLORS[type] }}>{stats[type]}</div>
              <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>→ {Math.ceil(stats[type] / 5)} 关</div>
            </div>
          );
        })}
      </div>

      {/* 当前筛选信息条 */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#1e40af' }}>📊 {TYPE_LABELS[filterType]}池：共 <b>{filteredCount}</b> 道题目，自动生成 <b>{filteredStages}</b> 个关卡</span>
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
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            .map(slice => {
              const isNew = (slice.createdAt || 0) > Date.now() - 10 * 60 * 1000;
              return (
            <div
              key={slice.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: 'white',
                borderLeft: `4px solid ${TYPE_COLORS[slice.module]}`,
                borderRadius: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  background: `${TYPE_COLORS[slice.module]}15`,
                  color: TYPE_COLORS[slice.module],
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold'
                }}>
                  {TYPE_LABELS[slice.module]}
                </span>
                <span style={{ color: '#1f2937', fontWeight: '500' }}>
                  {String((slice.content as unknown as Record<string, unknown>).raw || (slice.content as unknown as Record<string, unknown>).symbol || (slice.content as unknown as Record<string, unknown>).theory || (slice.content as unknown as Record<string, unknown>).pattern || '')}
                </span>
                {slice.module === 'notes' && (
                  <span style={{
                    padding: '1px 6px',
                    borderRadius: '4px',
                    border: '1px solid #e5e7eb',
                    color: '#6b7280',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    flexShrink: 0
                  }}>
                    {getStaffLabel((slice.content as unknown as Record<string, unknown>).pitch as string || (slice.content as unknown as Record<string, unknown>).raw as string, ((slice.content as unknown as Record<string, unknown>).placement as 'auto' | 'treble' | 'bass') || undefined)}
                  </span>
                )}
                {isNew && (
                  <span style={{
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: '#fee2e2',
                    color: '#ef4444',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    flexShrink: 0
                  }}>
                    新
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                {/* 难度调节 */}
                <div style={{ display: 'flex', alignItems: 'center', background: '#fef3c7', borderRadius: '6px', padding: '2px 4px' }}>
                  <button onClick={() => updateSliceDifficulty(slice.id, -1)} style={{ background: 'transparent', border: 'none', color: '#d97706', cursor: 'pointer', fontWeight: 'bold', padding: '0 6px' }}>−</button>
                  <span style={{ fontSize: '0.8rem', color: '#b45309', fontWeight: 'bold', minWidth: '36px', textAlign: 'center' }}>
                    L{slice.difficulty}
                  </span>
                  <button onClick={() => updateSliceDifficulty(slice.id, 1)} style={{ background: 'transparent', border: 'none', color: '#d97706', cursor: 'pointer', fontWeight: 'bold', padding: '0 6px' }}>+</button>
                </div>
                {/* 删除 */}
                <button
                  onClick={() => removeSlice(slice.id)}
                  style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                >
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
    </>
  );
}
