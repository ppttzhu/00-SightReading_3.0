import { useState } from 'react';
import type { CommentNode } from '../../hooks/useStageComments';
import StageCommentForm from './StageCommentForm';
import StageCommentActions from './StageCommentActions';

const REPLY_PREVIEW_COUNT = 2;

interface Props {
  comment: CommentNode;
  currentUserId: string | null;
  onToggleLike: (commentId: string, isLiked: boolean) => Promise<boolean>;
  onSubmitReply: (content: string, parentId: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  depth?: number;
}

export default function StageCommentCard({ comment, currentUserId, onToggleLike, onSubmitReply, onDelete, depth = 0 }: Props) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showAllReplies, setShowAllReplies] = useState(false);
  const isOwn = currentUserId === comment.userId;

  const handleLike = () => onToggleLike(comment.id, comment.isLiked);
  const handleReply = (content: string) => onSubmitReply(content, comment.id);

  const hasMoreReplies = comment.replies.length > REPLY_PREVIEW_COUNT;
  const visibleReplies = hasMoreReplies && !showAllReplies
    ? comment.replies.slice(0, REPLY_PREVIEW_COUNT)
    : comment.replies;

  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: '10px',
      background: depth === 0 ? '#f9fafb' : 'transparent',
      border: depth === 0 ? '1px solid #f3f4f6' : 'none',
      borderLeft: depth > 0 && depth <= 2 ? '2px solid #e5e7eb' : 'none',
      marginLeft: depth > 2 ? `${(depth - 2) * 4}px` : undefined,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151' }}>
          {comment.userNickname || '匿名'}
        </span>
        <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
          {formatTime(comment.createdAt)}
        </span>
      </div>
      <div style={{ fontSize: '0.85rem', color: '#1f2937', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {comment.content}
      </div>

      <StageCommentActions
        isLiked={comment.isLiked}
        likeCount={comment.likeCount}
        onToggleLike={handleLike}
        onReply={() => setShowReplyForm(v => !v)}
        onDelete={isOwn ? () => onDelete(comment.id) : undefined}
      />

      {showReplyForm && (
        <div style={{ marginTop: '8px' }}>
          <StageCommentForm
            placeholder={`回复 @${comment.userNickname}...`}
            onSubmit={async (content) => {
              const ok = await handleReply(content);
              if (ok) setShowReplyForm(false);
              return ok;
            }}
            onCancel={() => setShowReplyForm(false)}
          />
        </div>
      )}

      {visibleReplies.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
          {visibleReplies.map(reply => (
            <StageCommentCard
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              onToggleLike={onToggleLike}
              onSubmitReply={onSubmitReply}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
          {hasMoreReplies && !showAllReplies && (
            <button
              onClick={() => setShowAllReplies(true)}
              style={{
                alignSelf: 'flex-start', padding: '4px 10px', borderRadius: '6px', border: 'none',
                background: 'transparent', color: '#3b82f6', fontSize: '0.78rem', fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              查看全部 {comment.replies.length} 条回复
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;

  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  if (d.getFullYear() === now.getFullYear()) return `${month}月${day}日`;
  return `${d.getFullYear()}年${month}月${day}日`;
}
