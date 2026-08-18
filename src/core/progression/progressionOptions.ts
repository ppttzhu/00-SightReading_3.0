/**
 * Answer-option generation for progression practice.
 *
 * Unlike chord identification (which mixes the correct answer with random
 * distractors), the progression exercise presents ONE fixed button per selected
 * Progression, always in canonical order. The correct answer is therefore
 * always among the options, and the option set is stable across questions
 * within a session. This is pure and framework-free.
 */

import {
  LEVEL6_PROGRESSIONS,
  type AnswerChoice,
} from './progressions';
import type { SelectedProgressions } from './progressionSelection';

/**
 * Build the answer-option labels (Roman-numeral {@link AnswerChoice} strings)
 * for the learner's `selection`, in canonical progression order. Only selected
 * Progressions appear; an empty/invalid selection falls back to all four so
 * there is always something to render.
 *
 * @param selection the learner's selected Progressions
 * @returns the Answer_Choice labels to render as answer buttons, in fixed order
 */
export function buildOptions(selection: SelectedProgressions): AnswerChoice[] {
  const chosen = LEVEL6_PROGRESSIONS.filter((p) => selection.has(p.id));
  const defs = chosen.length > 0 ? chosen : LEVEL6_PROGRESSIONS;
  return defs.map((p) => p.answer);
}
