/**
 * Serialization of the Selected_Interval_Subset to and from the navigation
 * query string. This module is the integration boundary between the setup page
 * (`StageSelector`) and the practice screen (`IntervalPractice`): the setup
 * page encodes the chosen subset into `?scope=...` and the practice screen
 * decodes it back into a subset before generating the first question.
 *
 * The format is a compact, order-independent token list of catalog interval
 * IDs joined by commas (e.g. `scope=P1,m2,M3`). Encoding is deterministic
 * because ids are always emitted in canonical catalog order. Decoding is total
 * (never throws): unknown tokens are dropped, duplicates collapse, and an
 * absent/empty/all-invalid parameter falls back to `DEFAULT_SUBSET`.
 *
 * It is pure and framework-free — `decodeScope` takes a `URLSearchParams`, which
 * is a Web-standard type available in both the browser and test environments.
 */

import { INTERVAL_CATALOG, CATALOG_BY_ID } from './intervalCatalog';
import { DEFAULT_SUBSET } from './intervalSelection';
import type { Subset } from './intervalSelection';

/** The query-string parameter name that carries the interval scope. */
export const SCOPE_PARAM = 'scope';

/** The separator between interval ids in the encoded scope value. */
const TOKEN_SEPARATOR = ',';

/**
 * Encode a subset into its query-string value.
 *
 * Member ids are emitted in canonical catalog order (the order of
 * `INTERVAL_CATALOG`) and joined by `,`, so the output is deterministic and
 * independent of the subset's internal iteration order. An empty subset encodes
 * to the empty string.
 *
 * @param subset the selected interval ids
 * @returns e.g. `"P1,m2,M3"`
 */
export function encodeScope(subset: Subset): string {
  return INTERVAL_CATALOG.filter((entry) => subset.has(entry.id))
    .map((entry) => entry.id)
    .join(TOKEN_SEPARATOR);
}

/**
 * Decode the `scope` parameter into a subset of catalog ids.
 *
 * The value is split on `,`, each token is trimmed, and only tokens that name a
 * real catalog interval (present in `CATALOG_BY_ID`) are kept; collecting them
 * into a `Set` collapses duplicates automatically. When the parameter is
 * absent, empty, or contains no valid catalog id, `DEFAULT_SUBSET` is returned.
 * This function never throws, so hand-edited or stale URLs are always safe.
 *
 * @param params the URL search params to read `scope` from
 * @returns the decoded subset, or `DEFAULT_SUBSET` on absent/empty/all-invalid
 */
export function decodeScope(params: URLSearchParams): Subset {
  const raw = params.get(SCOPE_PARAM);
  if (raw === null) {
    return DEFAULT_SUBSET;
  }

  const ids = new Set<string>();
  for (const token of raw.split(TOKEN_SEPARATOR)) {
    const id = token.trim();
    if (CATALOG_BY_ID.has(id)) {
      ids.add(id);
    }
  }

  return ids.size > 0 ? ids : DEFAULT_SUBSET;
}
