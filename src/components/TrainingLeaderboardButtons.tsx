import { useState, type ReactNode } from 'react';
import GlobalRankingModal from './GlobalRankingModal';
import type { RankingType } from '../core/leaderboard/rankingsTypes';

interface TrainingLeaderboardButtonsProps {
  moduleId?: string;
  children?: ReactNode;
  compact?: boolean;
}

export default function TrainingLeaderboardButtons({
  moduleId,
  children,
  compact = false,
}: TrainingLeaderboardButtonsProps) {
  const [openType, setOpenType] = useState<RankingType | null>(null);

  return (
    <div className={`training-lb-section${compact ? ' training-lb-section--compact' : ''}`}>
      <div className="training-lb-buttons">
        <button
          type="button"
          className="training-lb-btn training-lb-btn--ability"
          onClick={() => setOpenType('ability')}
        >
          能力榜
        </button>
        <button
          type="button"
          className="training-lb-btn training-lb-btn--effort"
          onClick={() => setOpenType('effort')}
        >
          努力榜
        </button>
      </div>
      {children}
      {openType && (
        <GlobalRankingModal
          type={openType}
          moduleId={moduleId}
          onClose={() => setOpenType(null)}
        />
      )}
    </div>
  );
}
