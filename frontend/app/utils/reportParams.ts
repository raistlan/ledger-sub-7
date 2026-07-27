/**
 * Query-param handling for the reports screen.
 *
 * The backend summary endpoint accepts exactly `start`, `end` and `group_by`.
 * Everything else in the incoming query string is ignored on purpose: under
 * `v8_passThroughRequests` loaders receive the raw request, whose search params
 * may include React Router internals that must not reach the API.
 */

/** True when the caller pinned both ends of the range explicitly. */
export function hasExplicitRange(params: URLSearchParams): boolean {
  return params.has("start") && params.has("end");
}

/**
 * Build the backend summary path from the incoming params, falling back to
 * `defaults` per-bound for anything the caller left out.
 */
export function buildSummaryPath(
  params: URLSearchParams,
  defaults: { start: string; end: string },
): string {
  const out = new URLSearchParams();
  out.set("start", params.get("start") ?? defaults.start);
  out.set("end", params.get("end") ?? defaults.end);

  const groupBy = params.get("group_by");
  if (groupBy) out.set("group_by", groupBy);

  return `/reports/summary?${out.toString()}`;
}
