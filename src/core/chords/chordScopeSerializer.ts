/**
 * Serialization of the Selected_Chord_Types to and from the navigation query
 * string. This module is the integration boundary between the setup page
 * (`StageSelector` 和弦 branch) and the practice screen (`ChordPractice`): the
 * setup page encodes the chosen selection into `?scope=...` and the practice
 * screen decodes it back into a selection before generating the first question.
 *
 * The format is a compact, order-independent token list of catalog chord ids
 * joined by commas (e.g. `scope=maj,min,aug`). Encoding is deterministic
 * because ids are always emitted in canonical catalog order. Decoding is total
 * (never throws): unknown tokens are dropped, duplicates collapse, and an
 * absent/empty/all-invalid parameter falls back to `DEFAULT_SELECTION`.
 *
 * It is pure and framework-free — `decodeScope` takes a `URLSearchParams`,
 * which is a Web-standard type available in both the browser and test
 * environments. It mirrors `src/core/theory/scopeSerializer.ts` one-for-one.
 */

import { CHORD_CATALOG, CATALOG_BY_ID } from './chordCatalog';
import { DEFAULT_SELECTION } from './chordSelection';
import type { SelectedChordTypes } from './chordSelection';

/** The query-string parameter name that carries the chord scope. */
export const SCOPE_PARAM = 'scope';

/** The separator between chord ids in the encoded scope value. */
const TOKEN_SEPARATOR = ',';

/**
 * Encode a selection into its query-string value.
 *
 * Member ids are emitted in canonical catalog order (the order of
 * `CHORD_CATALOG`) and joined by `,`, so the output is deterministic and
 * independent of the selection's internal iteration order (Requirement 5.2).
 * An empty selection encodes to the empty string.
 *
 * @param selection the selected chord ids
 * @returns e.g. `"maj,min,aug"`
 */
export function encodeScope(selection: SelectedChordTypes): string {
  return CHORD_CATALOG.filter((entry) => selection.has(entry.id))
    .map((entry) => entry.id)
    .join(TOKEN_SEPARATOR);
}

/**
 * Decode the `scope` parameter into a selection of catalog ids.
 *
 * The value is split on `,`, each token is trimmed, and only tokens that name a
 * real catalog chord (present in `CATALOG_BY_ID`) are kept (Requirement 5.4);
 * collecting them into a `Set` collapses duplicates automatically
 * (Requirement 5.5). When the parameter is absent, empty, or contains no valid
 * catalog id, `DEFAULT_SELECTION` is returned (Requirement 5.6). This function
 * never throws, so hand-edited or stale URLs are always safe.
 *
 * @param params the URL search params to read `scope` from
 * @returns the decoded selection, or `DEFAULT_SELECTION` on absent/empty/all-invalid
 */
export function decodeScope(params: URLSearchParams): SelectedChordTypes {
  const raw = params.get(SCOPE_PARAM);
  if (raw === null) {
    return DEFAULT_SELECTION;
  }

  const ids = new Set<string>();
  for (const token of raw.split(TOKEN_SEPARATOR)) {
    const id = token.trim();
    if (CATALOG_BY_ID.has(id)) {
      ids.add(id);
    }
  }

  return ids.size > 0 ? ids : DEFAULT_SELECTION;
}
