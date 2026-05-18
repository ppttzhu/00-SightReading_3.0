import { useEffect, useState } from 'react';
import { X, Trophy, Zap } from 'lucide-react';
import { fetchRankings } from '../core/leaderboard/rankingsService';
import type { RankingPeriod, RankingRow, RankingType } from '../core/leaderboard/rankingsTypes';
import { PERIOD_LABELS } from '../core/leaderboard/periodUtils';
import { formatTimeMs } from '../core/leaderboard/formatTime';
import { useAuth } from '../core/auth/AuthProvider';
import { resolvePlayerIdentity } from '../core/leaderboard/playerIdentity';

const MODULE_NAMES: Record<string, string> = {
  notes: '单音',
  symbols: '音乐表情记号',
  theory: '双音/音程',
  patterns: '音型',
};

interface GlobalRankingModalProps {
  type: RankingType;
  moduleId?: string;
  onClose: () => void;
}

export default function GlobalRankingModal({ type, moduleId, onClose }: GlobalRankingModalProps) {
  const { user } = useAuth();
  const { playerKey: currentPlayerKey } = resolvePlayerIdentity(user?.id);
  const [period, setPeriod] = useState<RankingPeriod>('week');
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const title = type === 'ability' ? '能力榜' : '努力榜';
  const subtitle = type === 'ability'
    ? '100% 正确通关的最快用时（越短越好）'
    : '通关次数（越多越好）';
  const scopeLabel = moduleId ? MODULE_NAMES[moduleId] ?? moduleId : '全模块';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchRankings(type, period, moduleId).then(data => {
      if (!cancelled) {
        setRows(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [type, period, moduleId]);

  return (
    <div
      className="stage-complete-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="global-ranking-modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="stage-complete-close" onClick={onClose} aria-label="关闭">
          <X size={20} />
        </button>

        <div className="global-ranking-header">
          {type === 'ability' ? <Zap size={28} color="#3b82f6" /> : <Trophy size={28} color="#f59e0b" />}
          <h2>{title}</h2>
          <p className="global-ranking-scope">{scopeLabel} · {subtitle}</p>
        </div>

        <div className="global-ranking-period-tabs">
          {(['week', 'month', 'year'] as const).map(p => (
            <button
              key={p}
              type="button"
              className={`global-ranking-period-tab${period === p ? ' global-ranking-period-tab--active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="stage-complete-loading">加载排行榜...</p>
        ) : rows.length === 0 ? (
          <p className="stage-complete-empty">本时段暂无记录，快去通关吧！</p>
        ) : (
          <div className="stage-complete-table-wrap">
            <table className="stage-complete-table">
              <thead>
                <tr>
                  <th>排名</th>
                  <th>玩家</th>
                  <th>{type === 'ability' ? '最快用时' : '通关次数'}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={row.id === currentPlayerKey ? 'stage-complete-row--self' : ''}
                  >
                    <td>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : row.rank}
                    </td>
                    <td>
                      {row.displayName}
                      {row.id === currentPlayerKey && <span className="stage-complete-you">（你）</span>}
                    </td>
                    <td>
                      {type === 'ability' ? formatTimeMs(row.value) : `${row.value} 次`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
