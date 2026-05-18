import { X } from 'lucide-react';
import type { PracticeInsights } from '../core/practice/questionTracker';
import PracticeInsightSection from './PracticeInsightSection';

interface PracticeSummaryModalProps {
  title: string;
  score: number;
  total: number;
  insights: PracticeInsights;
  onClose: () => void;
  onConfirmExit: () => void;
}

export default function PracticeSummaryModal({
  title,
  score,
  total,
  insights,
  onClose,
  onConfirmExit,
}: PracticeSummaryModalProps) {
  const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;

  return (
    <div
      className="stage-complete-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="stage-complete-modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="stage-complete-close" onClick={onClose} aria-label="关闭">
          <X size={20} />
        </button>

        <div className="stage-complete-header">
          <h2>练习小结</h2>
          <p className="stage-complete-subtitle">{title}</p>
        </div>

        <div className="stage-complete-stats">
          <div className="stage-complete-stat">
            <span>答题数</span>
            <strong>{total}</strong>
          </div>
          <div className="stage-complete-stat">
            <span>正确率</span>
            <strong>{accuracy}%</strong>
          </div>
          <div className="stage-complete-stat">
            <span>得分</span>
            <strong>{score}/{total}</strong>
          </div>
        </div>

        <PracticeInsightSection insights={insights} />

        <div className="practice-summary-actions">
          <button type="button" className="stage-complete-btn stage-complete-btn--secondary" onClick={onClose}>
            继续练习
          </button>
          <button type="button" className="stage-complete-btn" onClick={onConfirmExit}>
            结束并返回
          </button>
        </div>
      </div>
    </div>
  );
}
