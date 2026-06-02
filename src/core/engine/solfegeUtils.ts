const SOLFEGE: Record<string, string> = {
  C: 'do',
  D: 're',
  E: 'mi',
  F: 'fa',
  G: 'sol',
  A: 'la',
  B: 'si',
};

/** 将音名（如 C、C#、Db）转为固定调唱名，升/降号前缀为「升」「降」。 */
export function answerLetterToSolfege(answer: string): string {
  const m = /^([A-Ga-g])([#b]?)/.exec(answer.trim());
  if (!m) return '';
  const letter = m[1].toUpperCase();
  const acc = m[2];
  const base = SOLFEGE[letter];
  if (!base) return '';
  if (acc === '#') return `升 ${base}`;
  if (acc === 'b') return `降 ${base}`;
  return base;
}
