import { renderHook } from "@testing-library/react";
import { useLocalToday } from "./useLocalToday";

describe("useLocalToday", () => {
  it("returns a string in YYYY-MM-DD format", () => {
    const { result } = renderHook(() => useLocalToday());
    expect(result.current).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns today's local date", () => {
    const d = new Date();
    const expected = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");

    const { result } = renderHook(() => useLocalToday());
    expect(result.current).toBe(expected);
  });
});
