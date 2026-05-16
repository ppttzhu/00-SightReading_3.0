import { describe, it, expect } from 'vitest';
import { mapKeyToNote } from './keyboardInput';

describe('mapKeyToNote', () => {
  it('maps lowercase note letters to uppercase', () => {
    expect(mapKeyToNote('c')).toBe('C');
    expect(mapKeyToNote('d')).toBe('D');
    expect(mapKeyToNote('e')).toBe('E');
    expect(mapKeyToNote('f')).toBe('F');
    expect(mapKeyToNote('g')).toBe('G');
    expect(mapKeyToNote('a')).toBe('A');
    expect(mapKeyToNote('b')).toBe('B');
  });

  it('maps uppercase note letters as-is', () => {
    expect(mapKeyToNote('C')).toBe('C');
    expect(mapKeyToNote('B')).toBe('B');
  });

  it('returns null for non-note letters', () => {
    expect(mapKeyToNote('h')).toBeNull();
    expect(mapKeyToNote('x')).toBeNull();
    expect(mapKeyToNote('z')).toBeNull();
  });

  it('returns null for control keys', () => {
    expect(mapKeyToNote('Enter')).toBeNull();
    expect(mapKeyToNote('Escape')).toBeNull();
    expect(mapKeyToNote('ArrowLeft')).toBeNull();
    expect(mapKeyToNote('Shift')).toBeNull();
  });

  it('returns null for space and empty string', () => {
    expect(mapKeyToNote(' ')).toBeNull();
    expect(mapKeyToNote('')).toBeNull();
  });

  it('returns null for digits and punctuation', () => {
    expect(mapKeyToNote('1')).toBeNull();
    expect(mapKeyToNote('.')).toBeNull();
    expect(mapKeyToNote('/')).toBeNull();
  });
});
