import { getLocalDateFromCookie } from "./api.server";

describe("getLocalDateFromCookie", () => {
  it("parses a valid localDate cookie", () => {
    const result = getLocalDateFromCookie("session=abc; localDate=2026-03-11; csrf=xyz");
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2); // 0-indexed March
    expect(result.getDate()).toBe(11);
  });

  it("falls back to current date when cookie is absent", () => {
    const before = new Date();
    const result = getLocalDateFromCookie("session=abc");
    const after = new Date();
    expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("falls back to current date when localDate has invalid format", () => {
    const before = new Date();
    const result = getLocalDateFromCookie("localDate=not-a-date");
    const after = new Date();
    expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("returns date at noon (T12:00:00) to avoid midnight UTC edge cases", () => {
    const result = getLocalDateFromCookie("localDate=2026-03-11");
    expect(result.getHours()).toBe(12);
    expect(result.getMinutes()).toBe(0);
  });
});
