import { createHash, randomBytes } from "node:crypto";
import { type LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const state = randomBytes(32).toString("base64url");

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    access_type: "online",
  });

  const isProd = process.env.NODE_ENV === "production";
  const secure = isProd ? "; Secure" : "";

  const headers = new Headers();
  headers.append("Set-Cookie", `oauth_state=${state}; HttpOnly${secure}; SameSite=Lax; Max-Age=600; Path=/`);
  headers.append("Set-Cookie", `pkce_verifier=${codeVerifier}; HttpOnly${secure}; SameSite=Lax; Max-Age=600; Path=/`);
  headers.set("Location", `https://accounts.google.com/o/oauth2/v2/auth?${params}`);

  throw new Response(null, { status: 302, headers });
}
