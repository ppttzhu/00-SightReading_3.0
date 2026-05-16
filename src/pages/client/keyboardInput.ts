const NOTE_KEYS = new Set(['C', 'D', 'E', 'F', 'G', 'A', 'B']);

export function mapKeyToNote(key: string): string | null {
  if (key.length !== 1) return null;
  const upper = key.toUpperCase();
  return NOTE_KEYS.has(upper) ? upper : null;
}
