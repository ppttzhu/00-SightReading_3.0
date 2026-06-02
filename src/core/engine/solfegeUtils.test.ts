import { describe, expect, it } from 'vitest';
import { answerLetterToSolfege } from './solfegeUtils';

describe('answerLetterToSolfege', () => {
  it('maps naturals', () => {
    expect(answerLetterToSolfege('C')).toBe('do');
    expect(answerLetterToSolfege('B')).toBe('xi');
  });

  it('maps sharps with 升 prefix', () => {
    expect(answerLetterToSolfege('C#')).toBe('升 do');
    expect(answerLetterToSolfege('F#')).toBe('升 fa');
  });

  it('maps flats with 降 prefix', () => {
    expect(answerLetterToSolfege('Db')).toBe('降 re');
    expect(answerLetterToSolfege('Bb')).toBe('降 xi');
  });

  it('handles pitch strings', () => {
    expect(answerLetterToSolfege('C#4')).toBe('升 do');
    expect(answerLetterToSolfege('Eb3')).toBe('降 mi');
  });
});
