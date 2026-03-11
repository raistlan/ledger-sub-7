import { fmt } from "./fmt";

describe("fmt", () => {
  it("formats integers with .00", () => {
    expect(fmt(100)).toBe("100.00");
  });

  it("formats decimals to 2 places", () => {
    expect(fmt(23.5)).toBe("23.50");
    expect(fmt(8.75)).toBe("8.75");
  });

  it("formats zero", () => {
    expect(fmt(0)).toBe("0.00");
  });

  it("formats large numbers with comma separators", () => {
    expect(fmt(1234567.89)).toBe("1,234,567.89");
  });

  it("rounds to 2 decimal places", () => {
    expect(fmt(3.141)).toBe("3.14");
    expect(fmt(3.145)).toBe("3.15");
  });
});
