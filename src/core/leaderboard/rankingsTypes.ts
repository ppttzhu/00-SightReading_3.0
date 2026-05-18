export type RankingType = 'ability' | 'effort';
export type RankingPeriod = 'week' | 'month' | 'year';

export interface RankingEvent {
  userId: string;
  displayName: string;
  moduleId: string;
  stageId: string;
  timeMs: number;
  perfect: boolean;
  completedAt: string;
}

export interface SubmitRankingEventPayload {
  displayName: string;
  moduleId: string;
  stageId: string;
  authUserId?: string | null;
  timeMs: number;
  perfect: boolean;
}

export interface RankingRow {
  id: string;
  displayName: string;
  value: number;
  rank: number;
}
