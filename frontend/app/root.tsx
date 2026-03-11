import {
  isRouteErrorResponse,
  Links,
  Meta,
  Navigate,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import "./styles/fonts.css";
import { C, font, raisedBorder, sunkenBorder, crtOverlay } from "~/utils/win95";

export const links: Route.LinksFunction = () => [
  { rel: "manifest", href: "/manifest.json" },
];

function getWeekLabel() {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // back to Sunday
  const month = weekStart.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const day = String(weekStart.getDate()).padStart(2, "0");
  return `WK OF ${month} ${day}`;
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000080" />
        <Meta />
        <Links />
      </head>
      <body style={{ margin: 0, fontFamily: font }}>
        <div className="app-outer">
          {/* Ambient desktop grid — desktop only */}
          <div className="desktop-bg" aria-hidden="true" />

          {/* Win95 application window */}
          <div className="app-panel" style={{ backgroundColor: C.bg }}>

            {/* Title bar — desktop only */}
            <div
              className="desktop-chrome"
              style={{
                backgroundColor: C.titleBar,
                backgroundImage: `linear-gradient(90deg, ${C.titleBar} 0%, ${C.titleBarBright} 50%, ${C.titleBar} 100%)`,
                padding: "4px 6px",
                justifyContent: "space-between",
                userSelect: "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>💹</span>
                <span style={{ color: "#ffffff", fontFamily: font, fontSize: 18, letterSpacing: "0.06em" }}>
                  L₇ - LEDGER SUB 7
                </span>
              </div>
              <div style={{ display: "flex", gap: 2 }}>
                {(["_", "□", "✕"] as const).map((btn, i) => (
                  <div
                    key={i}
                    style={{
                      ...raisedBorder(),
                      backgroundColor: C.surface,
                      width: 20,
                      height: 18,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      fontFamily: font,
                      fontSize: 13,
                      color: C.text,
                    }}
                  >
                    {btn}
                  </div>
                ))}
              </div>
            </div>

            {/* Content area — fills remaining height */}
            <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
              {/* CRT scanline overlay */}
              <div style={{ ...crtOverlay, position: "fixed", zIndex: 9999 }} aria-hidden="true" />
              {children}
            </div>

            {/* Status bar — desktop only */}
            <div
              className="desktop-chrome"
              style={{
                backgroundColor: C.surface,
                borderTop: `2px solid ${C.borderDark}`,
                padding: "3px 10px",
                gap: 12,
              }}
            >
              <div style={{ flex: 1, ...sunkenBorder, padding: "1px 6px", color: C.textMuted, fontFamily: font, fontSize: 14 }}>
                READY
              </div>
              <div style={{ ...sunkenBorder, padding: "1px 6px", color: C.textMuted, fontFamily: font, fontSize: 14, minWidth: 120, textAlign: "center" }}>
                {getWeekLabel()}
              </div>
            </div>
          </div>

          <ScrollRestoration />
          <Scripts />
        </div>
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const location = useLocation();
  let message = "OOPS!";
  let details = "An unexpected error occurred.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 401) {
      const redirectTo = encodeURIComponent(
        location.pathname + location.search,
      );
      return <Navigate to={`/login?redirectTo=${redirectTo}`} replace />;
    }
    message = error.status === 404 ? "404 NOT FOUND" : `ERROR ${error.status}`;
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
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
        {message}
      </div>
      <div style={{ fontSize: 20, color: C.textMuted, textAlign: "center" }}>
        {details}
      </div>
      <a
        href="/"
        style={{
          marginTop: 32,
          color: C.cyan,
          fontSize: 20,
          textDecoration: "underline",
          fontFamily: font,
        }}
      >
        [ RETURN HOME ]
      </a>
    </div>
  );
}
