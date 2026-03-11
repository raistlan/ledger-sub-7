import { useState } from "react";
import { redirect } from "react-router";
import type { Route } from "./+types/login";
import { C, font, raisedBorder } from "~/utils/win95";
import { ApiClient } from "~/lib/api.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirectTo") ?? "/";
  const error = url.searchParams.get("error");

  // Redirect to destination if already authenticated
  const api = new ApiClient(request.headers.get("Cookie") ?? "");
  try {
    await api.get("/auth/me");
    throw redirect(redirectTo);
  } catch (e) {
    if (e instanceof Response && e.status === 302) throw e;
    // Not authenticated — show login page
  }

  return { error };
}

export default function LoginPage({ loaderData }: Route.ComponentProps) {
  const { error } = loaderData;
  const [pressed, setPressed] = useState(false);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: C.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: font,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Logo */}
      <div
        style={{
          color: C.text,
          fontSize: 112,
          lineHeight: 1,
          letterSpacing: "-4px",
          marginBottom: 4,
          textShadow: `0 0 40px ${C.cyan}22, 0 0 80px ${C.cyan}11`,
        }}
      >
        L₇
      </div>

      {/* Subtitle */}
      <div
        style={{
          color: C.textMuted,
          fontSize: 17,
          letterSpacing: "0.3em",
          marginBottom: 64,
        }}
      >
        WEEKLY BUDGET TRACKER
      </div>

      {/* Error message */}
      {error && (
        <div
          style={{
            color: "#cc4444",
            fontSize: 16,
            marginBottom: 16,
            padding: "8px 16px",
            border: `1px solid #cc4444`,
          }}
        >
          {error === "oauth_failed"
            ? "Sign in failed. Please try again."
            : error}
        </div>
      )}

      {/* Sign In Button — links to backend OAuth initiation */}
      <a
        href="/api/v1/auth/login"
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => setPressed(false)}
        onTouchStart={() => setPressed(true)}
        onTouchEnd={() => setPressed(false)}
        style={{
          ...raisedBorder(pressed),
          backgroundColor: C.surface,
          color: C.text,
          fontFamily: font,
          fontSize: 20,
          letterSpacing: "0.06em",
          padding: pressed ? "13px 36px 11px" : "12px 36px",
          cursor: "pointer",
          userSelect: "none",
          outline: "none",
          textDecoration: "none",
          display: "inline-block",
        }}
      >
        [ SIGN IN WITH GOOGLE ]
      </a>

      {/* Version hint */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          color: C.textDim,
          fontSize: 14,
          letterSpacing: "0.1em",
        }}
      >
        VER 1.0.0
      </div>
    </div>
  );
}
