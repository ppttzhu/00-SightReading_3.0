// Option lists for single-note (A-type) answer UI in InteractiveQuiz and
// PracticeQuiz. Contract: always 7 unique options that include the correct
// answer — regardless of mode or whether accidentals are in play.

export const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const SHARP_NOTES = ['C#', 'D#', 'F#', 'G#', 'A#'];
export const FLAT_NOTES = ['Db', 'Eb', 'Gb', 'Ab', 'Bb'];

const OPTION_COUNT = 7;

// Build exactly 7 unique options that include `correct`. Pool is the full
// candidate set; when pool ≤ 7, return its de-duped contents in order (the
// natural-only case). When pool > 7, pick `correct` + 6 random distractors
// from pool and shuffle.
function buildSevenOptions(correct: string, pool: string[]): string[] {
  const deduped = Array.from(new Set(pool));
  if (deduped.length <= OPTION_COUNT) {
    if (correct && !deduped.includes(correct)) {
      return [correct, ...deduped.slice(0, OPTION_COUNT - 1)];
    }
    return deduped;
  }
  if (!correct) {
    return deduped.sort(() => Math.random() - 0.5).slice(0, OPTION_COUNT);
  }
  const distractors = deduped
    .filter(n => n !== correct)
    .sort(() => Math.random() - 0.5)
    .slice(0, OPTION_COUNT - 1);
  return [correct, ...distractors].sort(() => Math.random() - 0.5);
}

// InteractiveQuiz A-type options. Natural-letter questions show the 7 naturals
// in fixed order (matches main); accidental questions draw 6 distractors from
// the full 17-spelling pool so the answer is always present.
export function interactiveAOptions(correct: string): string[] {
  const pool = correct.length > 1
    ? [...NOTE_NAMES, ...SHARP_NOTES, ...FLAT_NOTES]
    : NOTE_NAMES;
  return buildSevenOptions(correct, pool);
}

// PracticeQuiz options. Pool is derived from the sharp/flat toggles; randomPitch
// only emits accidentals whose toggle is on, so `correct` is always in the pool.
export function practiceOptions(
  correct: string,
  includeSharps: boolean,
  includeFlats: boolean,
): string[] {
  const pool = [
    ...NOTE_NAMES,
    ...(includeSharps ? SHARP_NOTES : []),
    ...(includeFlats ? FLAT_NOTES : []),
  ];
  return buildSevenOptions(correct, pool);
}
