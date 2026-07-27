/**
 * Build the login URL for an unauthenticated request, preserving where the
 * user was headed so the login flow can return them there.
 *
 * Pass the *normalized* pathname (the `url` loader arg), not `request.url` —
 * under `v8_passThroughRequests` the raw request pathname carries a `.data`
 * suffix on data requests, which would produce a broken redirect target.
 */
export function buildLoginRedirect(pathname: string): string {
  return `/login?redirectTo=${encodeURIComponent(pathname)}`;
}
