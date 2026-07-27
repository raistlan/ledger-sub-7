import { buildLoginRedirect } from "./redirects";

describe("buildLoginRedirect", () => {
  it("points at /login with the pathname as redirectTo", () => {
    expect(buildLoginRedirect("/")).toBe("/login?redirectTo=%2F");
  });

  it("encodes nested paths", () => {
    expect(buildLoginRedirect("/reports")).toBe("/login?redirectTo=%2Freports");
  });

  it("encodes characters that would otherwise break the query string", () => {
    expect(buildLoginRedirect("/a b&c=d")).toBe(
      "/login?redirectTo=%2Fa%20b%26c%3Dd",
    );
  });

  it("round-trips back to the original pathname", () => {
    const pathname = "/reports?start=2026-01-01&end=2026-01-07";
    const url = new URL(buildLoginRedirect(pathname), "http://localhost");
    expect(url.searchParams.get("redirectTo")).toBe(pathname);
  });
});
