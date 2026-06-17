import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../core/store/useAppStore';
import { StageCommentList } from '../../components/comment';

export default function StageDetail() {
  const { stageId } = useParams<{ stageId: string }>();
  const navigate = useNavigate();
  const getAdventureStages = useAppStore(s => s.getAdventureStages);
  const slicesPool = useAppStore(s => s.slicesPool);
  const customStages = useAppStore(s => s.customStages);
  const stageOrder = useAppStore(s => s.stageOrder);
  const adventureStages = useAppStore(s => s.adventureStages);

  const stage = useMemo(() => {
    if (!stageId) return null;
    const stages = getAdventureStages();
    return stages.find(s => s.id === stageId) || null;
  }, [stageId, getAdventureStages, slicesPool, customStages, stageOrder, adventureStages]);

  if (!stage || !stageId) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.2rem', color: '#1f2937', margin: '0 0 8px' }}>关卡不存在</h2>
        <p style={{ fontSize: '0.85rem', color: '#9ca3af', margin: '0 0 16px' }}>未找到该关卡的信息</p>
        <button onClick={() => navigate('/client/adventure')} style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
          返回闯关地图
        </button>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: 'min(960px, 94vw)', width: '100%', margin: '0 auto', padding: '24px 16px',
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
    }}>
      {/* 返回按钮 */}
      <button
        onClick={() => navigate('/client/adventure')}
        style={{
          alignSelf: 'flex-start', marginBottom: '16px',
          padding: '6px 14px', borderRadius: '8px', border: '1px solid #e5e7eb',
          background: 'white', color: '#6b7280', fontSize: '0.85rem', fontWeight: 600,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
        }}
      >
        ← 返回地图
      </button>

      {/* 关卡标识 */}
      <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #e5e7eb' }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#374151', margin: '0 0 2px' }}>
          💬 {stage.title} — 评价
        </h1>
        {stage.description && (
          <p style={{ fontSize: '0.82rem', color: '#9ca3af', margin: 0 }}>
            {stage.description}
          </p>
        )}
      </div>

      {/* 评论区 */}
      <div style={{ flex: 1 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1f2937', margin: '0 0 16px' }}>
          评价 · 讨论
        </h2>
        <StageCommentList stageId={stageId} />
      </div>
    </div>
  );
}
