interface Props {
  isLiked: boolean;
  likeCount: number;
  onToggleLike: () => void;
  onReply: () => void;
  onDelete?: () => void;
}

export default function StageCommentActions({ isLiked, likeCount, onToggleLike, onReply, onDelete }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
      <button
        onClick={onToggleLike}
        style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '2px 8px', borderRadius: '6px', border: 'none',
          background: isLiked ? '#fee2e2' : 'transparent',
          color: isLiked ? '#ef4444' : '#6b7280',
          fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        title={isLiked ? '取消点赞' : '点赞'}
      >
        <span>{isLiked ? '❤️' : '🤍'}</span>
        {likeCount > 0 && <span>{likeCount}</span>}
      </button>
      <button
        onClick={onReply}
        style={{
          padding: '2px 8px', borderRadius: '6px', border: 'none',
          background: 'transparent', color: '#6b7280',
          fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
        }}
      >
        💬 回复
      </button>
      {onDelete && (
        <button
          onClick={onDelete}
          style={{
            padding: '2px 8px', borderRadius: '6px', border: 'none',
            background: 'transparent', color: '#9ca3af',
            fontSize: '0.78rem', cursor: 'pointer', marginLeft: 'auto',
          }}
          title="删除"
        >
          🗑️
        </button>
      )}
    </div>
  );
}
