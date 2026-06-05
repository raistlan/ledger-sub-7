import {
  lerp,
  getNormalPipColor,
  getOverBudgetPipColor,
  progressBlocks,
} from "./win95";

describe("lerp", () => {
  it("returns start value at t=0", () => {
    expect(lerp(0, 100, 0)).toBe(0);
  });

  it("returns end value at t=1", () => {
    expect(lerp(0, 100, 1)).toBe(100);
  });

  it("returns midpoint at t=0.5", () => {
    expect(lerp(0, 200, 0.5)).toBe(100);
  });

  it("rounds to nearest integer", () => {
    expect(lerp(0, 3, 0.5)).toBe(2); // 1.5 rounds to 2
  });
});

describe("getNormalPipColor", () => {
  it("pip 0 is green (R low, G high)", () => {
    const color = getNormalPipColor(0);
    expect(color).toBe("rgb(0,204,68)");
  });

  it("pip 10 is yellow (R high, G high, B zero)", () => {
    const color = getNormalPipColor(10);
    expect(color).toBe("rgb(204,204,0)");
  });

  it("pip 10 is continuous — same result from phase 1 and phase 2", () => {
    // Phase 1: i=10, t=10/10=1 → rgb(lerp(0,204,1), lerp(204,204,1), lerp(68,0,1)) = rgb(204,204,0)
    // Phase 2: i=10, t=(10-10)/5=0 → rgb(204, lerp(204,60,0), 0) = rgb(204,204,0)
    // Both yield the same yellow at the boundary
    expect(getNormalPipColor(10)).toBe("rgb(204,204,0)");
  });

  it("pip 19 is dark red (R moderate, G and B zero)", () => {
    const color = getNormalPipColor(19);
    // Phase 3: t=(19-16)/3=1 → rgb(lerp(204,160,1), lerp(60,0,1), 0) = rgb(160,0,0)
    expect(color).toBe("rgb(160,0,0)");
  });

  it("gradient is progressive — each pip shifts away from pure green", () => {
    // Extract green channel from early pips to verify it's decreasing (gradient in progress)
    const toRgb = (s: string) => s.match(/\d+/g)!.map(Number);
    const pip0 = toRgb(getNormalPipColor(0)); // [0, 204, 68]
    const pip5 = toRgb(getNormalPipColor(5)); // mid-phase-1
    const pip10 = toRgb(getNormalPipColor(10)); // [204, 204, 0]
    // Red increases from pip 0 to pip 10
    expect(pip5[0]).toBeGreaterThan(pip0[0]);
    expect(pip10[0]).toBeGreaterThan(pip5[0]);
    // Blue decreases from pip 0 to pip 10
    expect(pip5[2]).toBeLessThan(pip0[2]);
    expect(pip10[2]).toBeLessThan(pip5[2]);
  });

  it("phase 2 boundary (pip 15) is orange-red", () => {
    // t=(15-10)/5=1 → rgb(204, lerp(204,60,1), 0) = rgb(204,60,0)
    expect(getNormalPipColor(15)).toBe("rgb(204,60,0)");
  });

  it("pip 16 phase 3 boundary matches pip 15 phase 2 end", () => {
    // t=(16-16)/3=0 → rgb(lerp(204,160,0), lerp(60,0,0), 0) = rgb(204,60,0)
    expect(getNormalPipColor(16)).toBe("rgb(204,60,0)");
  });
});

describe("progressBlocks", () => {
  it("is empty at fill 0", () => {
    expect(progressBlocks(0, 20)).toBe(0);
  });

  it("is full at fill 1", () => {
    expect(progressBlocks(1, 20)).toBe(20);
  });

  it("rounds to the nearest whole block", () => {
    expect(progressBlocks(0.5, 20)).toBe(10);
    expect(progressBlocks(0.49, 20)).toBe(10); // 9.8 → 10
    expect(progressBlocks(0.51, 20)).toBe(10); // 10.2 → 10
  });

  it("clamps fill below 0 to empty", () => {
    expect(progressBlocks(-0.5, 20)).toBe(0);
  });

  it("clamps fill above 1 to full", () => {
    expect(progressBlocks(1.5, 20)).toBe(20);
  });

  it("never exceeds the total block count", () => {
    for (let f = 0; f <= 1.2; f += 0.13) {
      expect(progressBlocks(f, 18)).toBeLessThanOrEqual(18);
      expect(progressBlocks(f, 18)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("getOverBudgetPipColor", () => {
  it("returns an rgb() string", () => {
    expect(getOverBudgetPipColor(0, 0)).toMatch(/^rgb\(\d+,\d+,0\)$/);
  });

  it("all pips have R as the dominant channel (red hue)", () => {
    for (let i = 0; i < 20; i++) {
      const [r, g] = getOverBudgetPipColor(i, 50).match(/\d+/g)!.map(Number);
      expect(r).toBeGreaterThan(g);
      expect(r).toBeGreaterThan(0);
    }
  });

  it("blue channel is always zero", () => {
    for (let i = 0; i < 20; i++) {
      const parts = getOverBudgetPipColor(i, 50).match(/\d+/g)!.map(Number);
      expect(parts[2]).toBe(0);
    }
  });

  it("higher overage yields higher R at pip 0 (more intense red)", () => {
    const low = getOverBudgetPipColor(0, 0).match(/\d+/g)!.map(Number);
    const high = getOverBudgetPipColor(0, 100).match(/\d+/g)!.map(Number);
    expect(high[0]).toBeGreaterThan(low[0]);
  });

  it("overage is capped at 100% for color purposes (200% same as 100%)", () => {
    expect(getOverBudgetPipColor(5, 100)).toBe(getOverBudgetPipColor(5, 200));
  });

  it("pips darken left to right (position gradient)", () => {
    const leftR = getOverBudgetPipColor(0, 50).match(/\d+/g)!.map(Number)[0];
    const rightR = getOverBudgetPipColor(19, 50).match(/\d+/g)!.map(Number)[0];
    expect(leftR).toBeGreaterThan(rightR);
  });
});
