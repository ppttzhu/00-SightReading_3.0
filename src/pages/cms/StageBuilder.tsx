import { useAppStore } from '../../core/store/useAppStore';

const TYPE_LABELS: Record<string, string> = {
  'A': '单音',
  'B': '符号',
  'C': '乐理',
  'D': '音型',
};

const TYPE_COLORS: Record<string, string> = {
  'A': '#3b82f6',
  'B': '#ec4899',
  'C': '#8b5cf6',
  'D': '#10b981',
};

export default function StageBuilder() {
  const slicesPool = useAppStore(state => state.slicesPool);
  const updateSliceDifficulty = useAppStore(state => state.updateSliceDifficulty);
  const removeSlice = useAppStore(state => state.removeSlice);
  const clearPool = useAppStore(state => state.clearPool);

  // 按类型分组统计
  const stats = {
    A: slicesPool.filter(s => s.type === 'A').length,
    B: slicesPool.filter(s => s.type === 'B').length,
    C: slicesPool.filter(s => s.type === 'C').length,
    D: slicesPool.filter(s => s.type === 'D').length,
  };

  const totalQuestions = slicesPool.length;
  const totalStages = Math.ceil(stats.A / 5) + Math.ceil(stats.B / 5) + Math.ceil(stats.C / 5) + Math.ceil(stats.D / 5);

  return (
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
            onClick={() => { if (confirm('确认清空全部题目？')) clearPool(); }}
            style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            清空题库
          </button>
        )}
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '30px' }}>
        {(['A', 'B', 'C', 'D'] as const).map(type => (
          <div key={type} style={{
            padding: '20px',
            borderRadius: '12px',
            background: 'white',
            border: `1px solid ${TYPE_COLORS[type]}20`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
          }}>
            <div style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '8px' }}>{TYPE_LABELS[type]}池 ({type})</div>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: TYPE_COLORS[type] }}>{stats[type]}</div>
            <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>→ {Math.ceil(stats[type] / 5)} 关</div>
          </div>
        ))}
      </div>

      {/* 全局信息条 */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#1e40af' }}>📊 共 <b>{totalQuestions}</b> 道题目，自动生成 <b>{totalStages}</b> 个关卡</span>
      </div>

      {/* 题目列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {slicesPool.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', background: '#f9fafb', borderRadius: '12px' }}>
            题库为空。请通过"文件解析器"或"手动出题器"添加题目。
          </div>
        ) : (
          slicesPool.map(slice => (
            <div
              key={slice.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: 'white',
                borderLeft: `4px solid ${TYPE_COLORS[slice.type]}`,
                borderRadius: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  background: `${TYPE_COLORS[slice.type]}15`,
                  color: TYPE_COLORS[slice.type],
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold'
                }}>
                  {TYPE_LABELS[slice.type]}
                </span>
                <span style={{ color: '#1f2937', fontWeight: '500' }}>
                  {slice.content.raw || slice.content.symbol || slice.content.theory || slice.content.pattern}
                </span>
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
          ))
        )}
      </div>
    </div>
  );
}
