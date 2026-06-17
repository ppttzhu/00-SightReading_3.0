import { useState } from 'react';
import GuidanceModal from './GuidanceModal';
import { StageCommentList } from './comment';
import type { GuidanceImage } from '../core/store/useAppStore';

// ── Types ──

interface QuestionResult {
  slice: { id: string; module: string; content: any };
  correctAnswer: string;
  userAnswer: string;
  isCorrect: boolean;
  revealed: boolean;
}

interface StageInfo {
  module?: string;
  title?: string;
  passCriteria?: { enabled: boolean; minAccuracy: number } | null;
  slices: any[];
}

export interface ReviewPanelProps {
  stageId: string;
  stage: StageInfo | null;
  sortedResults: QuestionResult[];
  correctCount: number;
  wrongCount: number;
  revealedCount: number;
  timeSpentSec: number;
  accuracy: number;
  passed: boolean;
  nextStageId?: string;
  stageTitle: string;
  guidance: string;
  guidanceImages: GuidanceImage[];
  onRetry: () => void;
  onContinueAdventure: (stageId: string) => void;
  onFinishQuiz: () => void;
}

// ── Helper ──

function getQuestionLabel(slice: QuestionResult['slice']): string {
  const content = slice.content as any;
  if (slice.module === 'theory') {
    const noteA = content.noteA || content.notes?.[0] || '';
    const noteB = content.noteB || content.notes?.[1] || '';
    return noteA && noteB ? `${noteA} → ${noteB}` : slice.id;
  }
  if (slice.module === 'notes') return content.pitch || content.raw || '';
  if (slice.module === 'symbols') return content.symbol || content.raw || '';
  return content.raw || content.pattern || '';
}

// ── Component ──

export default function ReviewPanel({
  stageId, stage, sortedResults, correctCount, wrongCount, revealedCount,
  timeSpentSec, accuracy, passed, nextStageId,
  stageTitle, guidance, guidanceImages,
  onRetry, onContinueAdventure, onFinishQuiz,
}: ReviewPanelProps) {
  const [showGuidance, setShowGuidance] = useState(false);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'white', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', paddingBottom: '100px' }}>
        <div style={{ maxWidth: 'min(960px, 94vw)', width: '100%', margin: '0 auto' }}>
          {stage?.module === 'adventure' && !passed && (
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '4px' }}>😅</div>
              <h2 style={{ margin: '0 0 2px', fontSize: '1.2rem', fontWeight: 700, color: '#1f2937' }}>差一点就过关了！</h2>
              <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#6b7280' }}>{stage?.title}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', background: '#f9fafb', borderRadius: '10px', fontSize: '0.85rem' }}>
                  <span style={{ color: '#6b7280' }}>正确率</span>
                  <span style={{ fontWeight: 700, color: '#dc2626' }}>{accuracy}% {stage?.passCriteria?.enabled && <span style={{ fontWeight: 400, color: '#9ca3af' }}>/ 要求 ≥{stage.passCriteria.minAccuracy}%</span>}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', background: '#f9fafb', borderRadius: '10px', fontSize: '0.85rem' }}>
                  <span style={{ color: '#6b7280' }}>答对/答错</span>
                  <span style={{ fontWeight: 700, color: '#374151' }}>{correctCount}/{correctCount + wrongCount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', background: '#f9fafb', borderRadius: '10px', fontSize: '0.85rem' }}>
                  <span style={{ color: '#6b7280' }}>用时</span>
                  <span style={{ fontWeight: 700, color: '#374151' }}>{Math.floor(timeSpentSec / 60)}分{timeSpentSec % 60}秒</span>
                </div>
              </div>
            </div>
          )}

          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1f2937', marginBottom: '4px' }}>答题回顾</h2>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '16px' }}>
            共 {sortedResults.length} 题 · 正确 {correctCount} · 错误 {wrongCount} · 揭示 {revealedCount}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {sortedResults.map((r, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px', borderRadius: '12px',
                background: r.isCorrect ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${r.isCorrect ? '#bbf7d0' : '#fecaca'}`,
              }}>
                <span style={{ fontSize: '1.3rem' }}>{r.isCorrect ? '✅' : r.revealed ? '💡' : '❌'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: '#1f2937', fontSize: '0.9rem' }}>{getQuestionLabel(r.slice)}</div>
                  <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                    {r.isCorrect ? (
                      <span style={{ color: '#059669' }}>✓ {r.correctAnswer}</span>
                    ) : (
                      <span>
                        你的答案：<span style={{ color: '#dc2626' }}>{r.userAnswer}</span>
                        {' · '}正确答案：<span style={{ color: '#059669', fontWeight: 600 }}>{r.correctAnswer}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 评论列表（仅冒险模式） */}
          {stage?.module === 'adventure' && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
              <StageCommentList stageId={stageId} />
            </div>
          )}
        </div>
      </div>

      <div style={{
        borderTop: '1px solid #e5e7eb', background: 'white',
        padding: '16px 24px', boxShadow: '0 -4px 12px rgba(0,0,0,0.08)',
      }}>
        <div style={{ maxWidth: 'min(960px, 94vw)', width: '100%', margin: '0 auto', display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={onRetry} style={{ padding: '12px 28px', borderRadius: '12px', border: 'none', background: '#f59e0b', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
            再来一次
          </button>
          {stage?.module === 'adventure' && passed && nextStageId && (
            <button onClick={() => onContinueAdventure(nextStageId)} style={{ padding: '12px 28px', borderRadius: '12px', border: 'none', background: '#10b981', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
              继续闯关
            </button>
          )}
          {stage?.module === 'adventure' && guidance && (
            <button onClick={() => setShowGuidance(true)} style={{ padding: '12px 28px', borderRadius: '12px', border: '1px solid #d1d5db', background: 'white', color: '#6b7280', fontWeight: 600, cursor: 'pointer' }}>
              查看学习指导
            </button>
          )}
          <button onClick={onFinishQuiz} style={{ padding: '12px 28px', borderRadius: '12px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
            返回闯关地图
          </button>
        </div>
      </div>

      {showGuidance && guidance && (
        <GuidanceModal
          title={stageTitle}
          guidance={guidance}
          guidanceImages={guidanceImages}
          onStart={() => setShowGuidance(false)}
          buttonText="好滴"
        />
      )}
    </div>
  );
}
