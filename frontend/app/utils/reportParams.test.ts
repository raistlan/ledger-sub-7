import { hasExplicitRange, buildSummaryPath } from "./reportParams";

const p = (qs: string) => new URLSearchParams(qs);

describe("hasExplicitRange", () => {
  it("is true only when both start and end are present", () => {
    expect(hasExplicitRange(p("start=2026-01-01&end=2026-01-07"))).toBe(true);
  });

  it("is false when only one bound is present", () => {
    expect(hasExplicitRange(p("start=2026-01-01"))).toBe(false);
    expect(hasExplicitRange(p("end=2026-01-07"))).toBe(false);
  });

  it("is false when neither is present", () => {
    expect(hasExplicitRange(p(""))).toBe(false);
  });
});

describe("buildSummaryPath", () => {
  const defaults = { start: "2026-03-01", end: "2026-03-07" };

  it("uses explicit start and end when both are given", () => {
    expect(buildSummaryPath(p("start=2026-01-01&end=2026-01-07"), defaults)).toBe(
      "/reports/summary?start=2026-01-01&end=2026-01-07",
    );
  });

  it("falls back to defaults when params are absent", () => {
    expect(buildSummaryPath(p(""), defaults)).toBe(
      "/reports/summary?start=2026-03-01&end=2026-03-07",
    );
  });

  it("falls back per-bound, not all-or-nothing", () => {
    expect(buildSummaryPath(p("start=2026-01-01"), defaults)).toBe(
      "/reports/summary?start=2026-01-01&end=2026-03-07",
    );
  });

  it("appends group_by when present", () => {
    expect(buildSummaryPath(p("group_by=day"), defaults)).toBe(
      "/reports/summary?start=2026-03-01&end=2026-03-07&group_by=day",
    );
  });

  it("omits group_by when absent", () => {
    expect(buildSummaryPath(p(""), defaults)).not.toContain("group_by");
  });

  /**
   * The reason this helper exists. Under `v8_passThroughRequests` the loader
   * sees the raw request, whose query string may carry React Router internals
   * (e.g. `_routes`). The old loader did `params.toString()` and forwarded the
   * whole thing to the backend — this must forward only known report params.
   */
  it("drops unknown params instead of forwarding them to the backend", () => {
    const path = buildSummaryPath(
      p("start=2026-01-01&end=2026-01-07&_routes=routes%2Freports&index="),
      defaults,
    );
    expect(path).toBe("/reports/summary?start=2026-01-01&end=2026-01-07");
    expect(path).not.toContain("_routes");
    expect(path).not.toContain("index");
  });

  it("encodes values rather than interpolating them raw", () => {
    expect(buildSummaryPath(p("group_by=a b&start=x&end=y"), defaults)).toBe(
      "/reports/summary?start=x&end=y&group_by=a+b",
    );
  });
});
