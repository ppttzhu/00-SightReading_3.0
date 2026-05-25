import { Loader2, Trophy } from 'lucide-react';
import { useEffortLeaderboard } from '../../../hooks/useEffortLeaderboard';
import { useAuth } from '../../../core/auth/AuthProvider';

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span style={{ fontSize: '1.2rem' }}>🥇</span>;
  if (rank === 2) return <span style={{ fontSize: '1.2rem' }}>🥈</span>;
  if (rank === 3) return <span style={{ fontSize: '1.2rem' }}>🥉</span>;
  return <span style={{ fontWeight: 700, minWidth: '28px', color: '#6b7280', textAlign: 'center' }}>{rank}</span>;
}

export default function EffortLeaderboardTab() {
  const { entries, currentUserEntry, loading, error, retry } = useEffortLeaderboard();
  const { user } = useAuth();

  if (loading) {
    return <div className="profile-loading"><Loader2 size={24} className="spin-icon" /></div>;
  }

  if (error) {
    return (
      <div className="profile-error">
        <span className="profile-error-message">{error}</span>
        <button className="profile-retry-button" onClick={retry}>
          重试
        </button>
      </div>
    );
  }

  if (entries.length === 0 && (!currentUserEntry || currentUserEntry.totalPracticeCount === 0)) {
    return <div className="profile-empty">上周暂无练习记录</div>;
  }

  const currentUserId = user?.id;
  const isCurrentUserInList = entries.some((e) => e.userId === currentUserId);

  return (
    <div>
      {/* Header */}
      <div className="leaderboard-header">
        <Trophy size={24} color="#f59e0b" />
        <div>
          <p className="leaderboard-subtitle">按近7天做题总数排名，多练多上榜！</p>
        </div>
      </div>

      <div className="leaderboard-list">
        {entries.map((entry) => {
          const isHighlighted = entry.userId === currentUserId;
          return (
            <div
              key={entry.userId}
              className={`leaderboard-row${isHighlighted ? ' leaderboard-row-highlight' : ''}`}
            >
              <RankBadge rank={entry.rank} />
              <span style={{ flex: 1 }}>
                {entry.nickname}
                {isHighlighted && <span className="leaderboard-you">（你）</span>}
              </span>
              <span style={{ fontWeight: 600, color: '#374151' }}>
                {entry.totalPracticeCount} 次
              </span>
            </div>
          );
        })}

        {/* Show current user at bottom if they have 0 practice count and are not in the list */}
        {!isCurrentUserInList && currentUserEntry && (
          <>
            <div style={{ borderTop: '1px dashed #d1d5db', margin: '8px 0' }} />
            <div className="leaderboard-row leaderboard-row-highlight">
              <RankBadge rank={currentUserEntry.rank} />
              <span style={{ flex: 1 }}>
                {currentUserEntry.nickname}
                <span className="leaderboard-you">（你）</span>
              </span>
              <span style={{ fontWeight: 600, color: '#374151' }}>
                {currentUserEntry.totalPracticeCount} 次
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
