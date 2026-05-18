import type { PracticeInsights } from '../core/practice/questionTracker';

interface PracticeInsightSectionProps {
  insights: PracticeInsights | null;
  title?: string;
}

export default function PracticeInsightSection({
  insights,
  title = '练习建议',
}: PracticeInsightSectionProps) {
  if (!insights || insights.messages.length === 0) return null;

  return (
    <div className="practice-insight-section">
      <h3 className="practice-insight-title">{title}</h3>
      <ul className="practice-insight-list">
        {insights.messages.map((msg, i) => (
          <li key={i}>{msg}</li>
        ))}
      </ul>
    </div>
  );
}
