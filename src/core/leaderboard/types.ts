export interface LeaderboardEntry {
  id: string;
  displayName: string;
  timeMs: number;
  completedAt: string;
}

export interface SubmitScorePayload {
  stageId: string;
  moduleId: string;
  displayName: string;
  /** 已登录用户的 Supabase UUID；未登录留空，将使用游客 ID */
  authUserId?: string | null;
  timeMs: number;
  perfect?: boolean;
}
