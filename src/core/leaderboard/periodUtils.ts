import type { RankingPeriod } from './rankingsTypes';

export function getPeriodStart(period: RankingPeriod, now = new Date()): Date {
  if (period === 'week') {
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return new Date(now.getFullYear(), 0, 1);
}

export const PERIOD_LABELS: Record<RankingPeriod, string> = {
  week: '周榜',
  month: '月榜',
  year: '年榜',
};
