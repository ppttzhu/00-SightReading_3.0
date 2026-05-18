import { useEffect, useState } from 'react';
import { Trophy, Clock, X } from 'lucide-react';
import type { LeaderboardEntry } from '../core/leaderboard/types';
import { fetchLeaderboard } from '../core/leaderboard/leaderboardService';
import { formatTimeMs } from '../core/leaderboard/formatTime';
import { getBeatPercentMessage } from '../core/leaderboard/beatPercent';
import type { PracticeInsights } from '../core/practice/questionTracker';
import PracticeInsightSection from './PracticeInsightSection';
import { resolvePlayerIdentity } from '../core/leaderboard/playerIdentity';
import { useAuth } from '../core/auth/AuthProvider';

interface StageCompleteModalProps {
  stageTitle: string;
  timeMs: number;
  displayName: string;
  stageId: string;
  initialEntries?: LeaderboardEntry[];
  insights?: PracticeInsights | null;
  onClose: () => void;
}

export default function StageCompleteModal({
  stageTitle,
  timeMs,
  displayName,
  stageId,
  initialEntries,
  insights,
  onClose,
}: StageCompleteModalProps) {
  const { user } = useAuth();
  const { playerKey: currentPlayerKey } = resolvePlayerIdentity(user?.id);
  const [entries, setEntries] = useState<LeaderboardEntry[]>(initialEntries ?? []);
  const [loading, setLoading] = useState(!initialEntries);

  useEffect(() => {
    if (initialEntries) {
      setEntries(initialEntries);
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchLeaderboard(stageId).then(data => {
      if (!cancelled) {
        setEntries(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [stageId, initialEntries]);

  const userRank = entries.findIndex(e => e.id === currentPlayerKey) + 1;
  const beatMessage = !loading ? getBeatPercentMessage(userRank, entries.length) : null;

  return (
    <div
      className="stage-complete-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stage-complete-title"
      onClick={onClose}
    >
      <div className="stage-complete-modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="stage-complete-close" onClick={onClose} aria-label="关闭">
          <X size={20} />
        </button>

        <div className="stage-complete-header">
          <div className="stage-complete-icon">
            <Trophy size={32} color="#f59e0b" />
          </div>
          <h2 id="stage-complete-title">🎉 通关成功！</h2>
          <p className="stage-complete-subtitle">{stageTitle}</p>
        </div>

        <div className="stage-complete-stats">
          <div className="stage-complete-stat">
            <Clock size={18} />
            <span>本次用时</span>
            <strong>{formatTimeMs(timeMs)}</strong>
          </div>
          {userRank > 0 && (
            <div className="stage-complete-stat">
              <Trophy size={18} />
              <span>你的排名</span>
              <strong>第 {userRank} 名</strong>
            </div>
          )}
        </div>

        {beatMessage && (
          <p className="stage-complete-beat-message">{beatMessage}</p>
        )}

        <PracticeInsightSection insights={insights ?? null} />

        <h3 className="stage-complete-leaderboard-title">通关排行榜</h3>
        <p className="stage-complete-leaderboard-hint">用时越短，排名越靠前</p>

        {loading ? (
          <p className="stage-complete-loading">加载排行榜...</p>
        ) : entries.length === 0 ? (
          <p className="stage-complete-empty">暂无记录，你是第一个通关的玩家！</p>
        ) : (
          <div className="stage-complete-table-wrap">
            <table className="stage-complete-table">
              <thead>
                <tr>
                  <th>排名</th>
                  <th>玩家</th>
                  <th>用时</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => (
                  <tr
                    key={entry.id}
                    className={entry.id === currentPlayerKey ? 'stage-complete-row--self' : ''}
                  >
                    <td>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                    </td>
                    <td>
                      {entry.displayName}
                      {entry.id === currentPlayerKey && <span className="stage-complete-you">（你）</span>}
                    </td>
                    <td>{formatTimeMs(entry.timeMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && entries.length > 0 && !entries.some(e => e.id === currentPlayerKey) && (
          <p className="stage-complete-pending">
            你的成绩（{displayName} · {formatTimeMs(timeMs)}）正在同步中…
          </p>
        )}

        <button type="button" className="stage-complete-btn" onClick={onClose}>
          返回关卡列表
        </button>
      </div>
    </div>
  );
}
