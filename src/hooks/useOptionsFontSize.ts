import { useMemo } from 'react';

/**
 * Computes a uniform font size for a set of quiz option buttons
 * based on the longest option text. All buttons in the same set
 * share the same font size so they look consistent.
 *
 * @param options  Array of option label strings
 * @returns A CSS font-size value (rem)
 */
export function getOptionsFontSize(options: string[]): string {
  const maxLen = Math.max(0, ...options.map(o => o.length));
  if (maxLen > 20) return '0.85rem';
  if (maxLen > 12) return '1rem';
  return '1.3rem';
}

/**
 * React hook wrapper — memoizes the font size based on options array.
 */
export function useOptionsFontSize(options: string[]): string {
  return useMemo(() => getOptionsFontSize(options), [options]);
}
