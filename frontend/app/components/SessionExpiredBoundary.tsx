import { useRouteError, isRouteErrorResponse, useLocation } from "react-router";
import { C, font, raisedBorder } from "~/utils/win95";

/**
 * Route-level ErrorBoundary for 401 Unauthorized errors.
 * Renders an in-place "session expired" panel instead of redirecting away,
 * preserving the user's page context. Non-401 errors are re-thrown so the
 * root ErrorBoundary can handle them.
 *
 * Export this as `ErrorBoundary` from any protected route:
 *   export { SessionExpiredBoundary as ErrorBoundary } from "~/components/SessionExpiredBoundary";
 */
export function SessionExpiredBoundary() {
  const error = useRouteError();
  const location = useLocation();

  if (isRouteErrorResponse(error) && error.status === 401) {
    const redirectTo = encodeURIComponent(location.pathname + location.search);
    return (
      <div
        style={{
          width: "100%",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: font,
          backgroundColor: C.bg,
          color: C.text,
          padding: 20,
          boxSizing: "border-box",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16, color: "#cc4444" }}>
          ERROR 401
        </div>
        <div
          style={{
            fontSize: 20,
            color: C.textMuted,
            textAlign: "center",
            marginBottom: 32,
          }}
        >
          Unauthorized. Please log in to continue.
        </div>
        <a
          href={`/login?redirectTo=${redirectTo}`}
          style={{
            ...raisedBorder(false),
            backgroundColor: C.surface,
            color: C.text,
            fontFamily: font,
            fontSize: 20,
            letterSpacing: "0.06em",
            padding: "12px 36px",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          [ LOG IN AGAIN ]
        </a>
      </div>
    );
  }

  // Non-401: bubble up to root ErrorBoundary
  throw error;
}
