import { type LoaderFunctionArgs } from "react-router";
import { extractCookie } from "~/lib/api.server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!;
const MAX_AGE = 14 * 24 * 60 * 60; // 14 days in seconds

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieHeader = request.headers.get("Cookie") ?? "";
  const oauthState = extractCookie(cookieHeader, "oauth_state");
  const pkceVerifier = extractCookie(cookieHeader, "pkce_verifier");

  const isProd = process.env.NODE_ENV === "production";
  const secure = isProd ? "; Secure" : "";

  // Always clear the one-time PKCE/state cookies, even on failure
  const clearCookies = [
    `oauth_state=; HttpOnly${secure}; SameSite=Lax; Max-Age=0; Path=/`,
    `pkce_verifier=; HttpOnly${secure}; SameSite=Lax; Max-Age=0; Path=/`,
  ];

  function fail(): never {
    const headers = new Headers();
    clearCookies.forEach((c) => headers.append("Set-Cookie", c));
    headers.set("Location", "/login?error=oauth_failed");
    throw new Response(null, { status: 302, headers });
  }

  // CSRF: validate state matches the one-time cookie
  if (!code || !state || !oauthState || !pkceVerifier || state !== oauthState) {
    fail();
  }

  // Exchange code + PKCE verifier with the backend (keeps client_secret server-side)
  let token: string;
  let csrfToken: string;
  try {
    const resp = await fetch(`${BACKEND_URL}/api/v1/auth/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        code_verifier: pkceVerifier,
        redirect_uri: GOOGLE_REDIRECT_URI,
      }),
    });

    if (!resp.ok) {
      fail();
    }

    const body = await resp.json();
    token = body.data.token;
    csrfToken = body.data.csrf_token;
  } catch {
    fail();
  }

  const headers = new Headers();
  clearCookies.forEach((c) => headers.append("Set-Cookie", c));

  // access_token: HttpOnly — not readable by JS
  headers.append(
    "Set-Cookie",
    `access_token=${token}; HttpOnly${secure}; SameSite=Lax; Max-Age=${MAX_AGE}; Path=/`,
  );
  // csrf_token: NOT HttpOnly — must be JS-readable for the Double Submit Cookie pattern
  headers.append(
    "Set-Cookie",
    `csrf_token=${csrfToken}; ${isProd ? "Secure; " : ""}SameSite=Strict; Max-Age=${MAX_AGE}; Path=/`,
  );

  headers.set("Location", "/");
  throw new Response(null, { status: 302, headers });
}
