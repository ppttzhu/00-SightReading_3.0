import { useAuth } from '../../core/auth/AuthProvider';
import { useStageComments, type SortBy } from '../../hooks/useStageComments';
import StageCommentCard from './StageCommentCard';
import StageCommentForm from './StageCommentForm';

interface Props {
  stageId: string;
  showForm?: boolean;
}

const sortOptions: { key: SortBy; label: string }[] = [
  { key: 'hot', label: '🔥 最热' },
  { key: 'new', label: '🕐 最新' },
];

export default function StageCommentList({ stageId, showForm = true }: Props) {
  const { user } = useAuth();
  const {
    comments, loading, loadingMore, error, hasMore, sortBy, setSortBy,
    loadMore, submitComment, deleteComment, toggleLike, retry,
  } = useStageComments(stageId);

  // 初始加载时显示 loading（还没有任何数据）
  if (loading && comments.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: '0.85rem' }}>
        加载评论...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* 排序切换 — 始终显示 */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
        {sortOptions.map(opt => (
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key)}
            style={{
              padding: '4px 12px', borderRadius: '6px', border: 'none',
              background: sortBy === opt.key ? '#3b82f6' : '#f3f4f6',
              color: sortBy === opt.key ? 'white' : '#6b7280',
              fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 新评论表单 */}
      {showForm && user && (
        <StageCommentForm
          placeholder="写一句评价..."
          onSubmit={content => submitComment(content)}
        />
      )}

      {!user && (
        <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.82rem', margin: '8px 0' }}>
          登录后可参与评价
        </p>
      )}

      {/* 错误提示（保留已有评论的情况下显示小横幅） */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 12px', borderRadius: '8px', background: '#fef2f2',
          color: '#dc2626', fontSize: '0.82rem',
        }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={retry} style={{
            padding: '4px 10px', borderRadius: '6px', border: 'none',
            background: '#dc2626', color: 'white', fontSize: '0.78rem',
            fontWeight: 600, cursor: 'pointer',
          }}>重试</button>
        </div>
      )}

      {/* 评论列表 */}
      {comments.length === 0 && !loading ? (
        <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem', padding: '16px 0', margin: 0 }}>
          暂无评论，来写第一条吧
        </p>
      ) : comments.length === 0 ? null : (
        comments.map(c => (
          <StageCommentCard
            key={c.id}
            comment={c}
            currentUserId={user?.id ?? null}
            onToggleLike={toggleLike}
            onSubmitReply={submitComment}
            onDelete={deleteComment}
          />
        ))
      )}

      {/* 加载更多 */}
      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          style={{
            width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb',
            background: 'white', color: '#6b7280', fontSize: '0.85rem', fontWeight: 600,
            cursor: loadingMore ? 'default' : 'pointer', marginTop: '4px',
          }}
        >
          {loadingMore ? '加载中...' : '加载更多评论'}
        </button>
      )}
    </div>
  );
}
