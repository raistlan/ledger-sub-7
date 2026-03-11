import { evalExpression } from "./calculator";

describe("evalExpression", () => {
  // Basic arithmetic
  it("handles simple addition", () => {
    expect(evalExpression("1+2")).toBe(3);
  });

  it("handles simple subtraction", () => {
    expect(evalExpression("10-3")).toBe(7);
  });

  it("handles multiplication", () => {
    expect(evalExpression("4x3")).toBe(12);
    expect(evalExpression("4*3")).toBe(12);
  });

  it("handles division", () => {
    // This was the bug: division was stripped in the original regex
    expect(evalExpression("10/2")).toBe(5);
    expect(evalExpression("15/4")).toBeCloseTo(3.75);
  });

  it("handles decimal numbers", () => {
    expect(evalExpression("10.50+5.25")).toBeCloseTo(15.75);
  });

  it("handles chained operations", () => {
    expect(evalExpression("10+5.50")).toBeCloseTo(15.50);
  });

  // Edge cases
  it("returns null for empty string", () => {
    expect(evalExpression("")).toBeNull();
  });

  it("returns null for invalid expression", () => {
    expect(evalExpression("abc")).toBeNull();
    expect(evalExpression("++")).toBeNull();
  });

  it("returns negative values (caller handles dialog)", () => {
    expect(evalExpression("5-10")).toBe(-5);
  });

  it("returns null for division by zero", () => {
    expect(evalExpression("5/0")).toBeNull();
  });

  it("handles partial cents (caller handles dialog)", () => {
    // 1/3 has more than 2 decimal places — returned as-is, caller rounds
    const result = evalExpression("1/3");
    expect(result).not.toBeNull();
    expect(result).toBeCloseTo(0.3333);
  });

  it("returns null for Infinity", () => {
    expect(evalExpression("1e400*1e400")).toBeNull();
  });

  it("handles parentheses correctly", () => {
    expect(evalExpression("(1+2)*3")).toBe(9);
    expect(evalExpression("10/(2+3)")).toBe(2);
    expect(evalExpression("(2+3)*(4-1)")).toBe(15);
  });

  it("returns null for mismatched parentheses", () => {
    expect(evalExpression("(1+2")).toBeNull();
  });
});
