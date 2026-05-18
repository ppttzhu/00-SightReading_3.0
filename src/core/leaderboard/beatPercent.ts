/** 根据排名计算击败了多少比例的「钢琴家」（用时越短排名越靠前） */
export function calcBeatPercent(rank: number, totalPlayers: number): number {
  if (totalPlayers <= 0 || rank <= 0) return 0;
  if (totalPlayers === 1) return 100;
  return Math.round(((totalPlayers - rank) / totalPlayers) * 100);
}

export function getBeatPercentMessage(rank: number, totalPlayers: number): string | null {
  if (totalPlayers <= 0 || rank <= 0) return null;
  if (totalPlayers === 1) return '🎹 你是首位通关的钢琴家！';
  const pct = calcBeatPercent(rank, totalPlayers);
  if (pct >= 100) return '🎹 你击败了所有钢琴家！';
  if (pct <= 0) return null;
  return `🎹 你击败了 ${pct}% 的钢琴家！`;
}
