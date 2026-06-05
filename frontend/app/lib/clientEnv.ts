/**
 * The backend's public origin, inlined at build time via Vite `define`
 * (reads BACKEND_URL from the build env — see vite.config.ts).
 *
 * The browser-driven wake (useWakeBackend) needs an absolute, cross-origin URL
 * to hit the backend's /health directly, and browser code has no process.env.
 * Build-time inlining avoids shipping the value through the document at runtime.
 *
 * `__BACKEND_URL__` is replaced with a string literal in the bundle. Under Jest
 * (no Vite, no define) it's undeclared, so we guard with `typeof`.
 */
declare const __BACKEND_URL__: string | undefined;

export function getBackendUrl(): string | undefined {
  return typeof __BACKEND_URL__ !== "undefined" && __BACKEND_URL__
    ? __BACKEND_URL__
    : undefined;
}
