/**
 * Serialization of the SelectedProgressions to and from the navigation query
 * string. This is the integration boundary between the setup page
 * (`StageSelector` patterns branch) and the practice screen
 * (`ProgressionPractice`): the setup page encodes the chosen selection into
 * `?scope=...` and the practice screen decodes it back before generating the
 * first question.
 *
 * The format is a compact, order-independent token list of ProgressionIds
 * joined by commas (e.g. `scope=maj_sub,min_dom`). Encoding is deterministic
 * because ids are emitted in canonical progression order. Decoding is total
 * (never throws): unknown tokens are dropped, duplicates collapse, and an
 * absent/empty/all-invalid parameter falls back to `DEFAULT_SELECTION`.
 *
 * It is pure and framework-free, mirroring `src/core/chords/chordScopeSerializer.ts`.
 */

import { LEVEL6_PROGRESSIONS, PROGRESSION_BY_ID, type ProgressionId } from './progressions';
import { DEFAULT_SELECTION, type SelectedProgressions } from './progressionSelection';

/** The query-string parameter name that carries the progression scope. */
export const SCOPE_PARAM = 'scope';

/** The separator between progression ids in the encoded scope value. */
const TOKEN_SEPARATOR = ',';

/**
 * Encode a selection into its query-string value. Ids are emitted in canonical
 * progression order (the order of `LEVEL6_PROGRESSIONS`) and joined by `,`, so
 * the output is deterministic. An empty selection encodes to the empty string.
 */
export function encodeScope(selection: SelectedProgressions): string {
  return LEVEL6_PROGRESSIONS.filter((p) => selection.has(p.id))
    .map((p) => p.id)
    .join(TOKEN_SEPARATOR);
}

/**
 * Decode the `scope` parameter into a selection of ProgressionIds. Only tokens
 * that name a real progression are kept; duplicates collapse via the Set. When
 * the parameter is absent, empty, or all-invalid, `DEFAULT_SELECTION` is
 * returned. Never throws, so hand-edited or stale URLs are always safe.
 */
export function decodeScope(params: URLSearchParams): SelectedProgressions {
  const raw = params.get(SCOPE_PARAM);
  if (raw === null) {
    return DEFAULT_SELECTION;
  }

  const ids = new Set<ProgressionId>();
  for (const token of raw.split(TOKEN_SEPARATOR)) {
    const id = token.trim();
    if (PROGRESSION_BY_ID.has(id as ProgressionId)) {
      ids.add(id as ProgressionId);
    }
  }

  return ids.size > 0 ? ids : DEFAULT_SELECTION;
}
