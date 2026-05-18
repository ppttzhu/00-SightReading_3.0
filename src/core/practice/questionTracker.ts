export type AttemptCategory = 'note' | 'symbol' | 'interval' | 'pattern' | 'other';

export interface QuestionAttempt {
  label: string;
  category: AttemptCategory;
  timeMs: number;
  correct: boolean;
}

export interface PracticeInsights {
  wrongLabels: string[];
  slowLabels: string[];
  messages: string[];
}

const DEFAULT_SLOW_MS = 8000;

const CATEGORY_HINT: Record<AttemptCategory, string> = {
  note: '以下音名建议加强练习',
  symbol: '以下音乐记号建议加强记忆',
  interval: '以下音程建议加强练习',
  pattern: '以下音型建议加强识别',
  other: '以下内容建议加强练习',
};

function median(nums: number[]): number {
  if (nums.length === 0) return DEFAULT_SLOW_MS;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function analyzeAttempts(records: QuestionAttempt[]): PracticeInsights {
  if (records.length === 0) {
    return { wrongLabels: [], slowLabels: [], messages: [] };
  }

  const correctTimes = records.filter(r => r.correct).map(r => r.timeMs);
  const slowThreshold = Math.max(
    DEFAULT_SLOW_MS,
    correctTimes.length >= 2 ? median(correctTimes) * 1.5 : DEFAULT_SLOW_MS,
  );

  const wrongByLabel = new Map<string, { count: number; category: AttemptCategory }>();
  const slowByLabel = new Map<string, { count: number; category: AttemptCategory }>();

  for (const r of records) {
    if (!r.correct) {
      const prev = wrongByLabel.get(r.label);
      wrongByLabel.set(r.label, {
        count: (prev?.count ?? 0) + 1,
        category: r.category,
      });
    } else if (r.timeMs >= slowThreshold) {
      const prev = slowByLabel.get(r.label);
      slowByLabel.set(r.label, {
        count: (prev?.count ?? 0) + 1,
        category: r.category,
      });
    }
  }

  const wrongLabels = [...wrongByLabel.keys()].sort(
    (a, b) => (wrongByLabel.get(b)?.count ?? 0) - (wrongByLabel.get(a)?.count ?? 0),
  );
  const slowLabels = [...slowByLabel.keys()].filter(l => !wrongByLabel.has(l)).sort(
    (a, b) => (slowByLabel.get(b)?.count ?? 0) - (slowByLabel.get(a)?.count ?? 0),
  );

  const messages: string[] = [];
  const byCategory = new Map<AttemptCategory, Set<string>>();

  const addWeak = (label: string, category: AttemptCategory) => {
    if (!byCategory.has(category)) byCategory.set(category, new Set());
    byCategory.get(category)!.add(label);
  };

  wrongLabels.forEach(l => addWeak(l, wrongByLabel.get(l)!.category));
  slowLabels.forEach(l => addWeak(l, slowByLabel.get(l)!.category));

  for (const [category, labels] of byCategory) {
    if (labels.size === 0) continue;
    messages.push(`${CATEGORY_HINT[category]}：${[...labels].join('、')}`);
  }

  if (wrongLabels.length > 0 && slowLabels.length > 0) {
    messages.push('提示：标出的内容包含答错题，或作答耗时明显偏长的题。');
  } else if (slowLabels.length > 0) {
    messages.push('提示：标出的题目你答对了，但思考时间偏长，可以多练几次提速。');
  }

  if (messages.length === 0 && records.length >= 3) {
    messages.push('本轮表现很棒，暂无明显薄弱项，继续保持！');
  }

  return { wrongLabels, slowLabels, messages };
}
