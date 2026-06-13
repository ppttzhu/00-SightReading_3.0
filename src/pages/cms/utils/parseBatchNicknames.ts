/**
 * Parse a batch import string into an array of trimmed, non-empty nicknames.
 * Splits on commas and newlines, trims whitespace, filters empty entries.
 */
export function parseBatchNicknames(input: string): string[] {
  return input
    .split(/\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}
