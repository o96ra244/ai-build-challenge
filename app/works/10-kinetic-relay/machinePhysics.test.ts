import { describe, expect, it } from "vitest";

import { PHYSICS_CONFIG, advanceFixedAccumulator } from "./machinePhysics";

describe("machinePhysics timing", () => {
  it("advances normal deltas in fixed 1/60 steps", () => {
    let steps = 0;
    const result = advanceFixedAccumulator(0, 1 / 30, () => { steps += 1; });
    expect(steps).toBe(2);
    expect(result.steps).toBe(2);
    expect(result.accumulator).toBeCloseTo(0);
  });

  it("caps large deltas to max substeps and discards a runaway remainder", () => {
    let steps = 0;
    const result = advanceFixedAccumulator(0.08, 2, () => { steps += 1; });
    expect(steps).toBe(PHYSICS_CONFIG.maxSubsteps);
    expect(result.steps).toBe(PHYSICS_CONFIG.maxSubsteps);
    expect(result.accumulator).toBe(0);
    expect(result.droppedTime).toBeGreaterThan(0);
  });

  it("does not move physics while the page is hidden", () => {
    let steps = 0;
    const result = advanceFixedAccumulator(0.01, 0.2, () => { steps += 1; }, false);
    expect(steps).toBe(0);
    expect(result.accumulator).toBeCloseTo(0.01);
    expect(result.droppedTime).toBe(0);
  });

  it("sanitizes invalid timing inputs", () => {
    let steps = 0;
    const result = advanceFixedAccumulator(Number.NaN, Number.POSITIVE_INFINITY, () => { steps += 1; });
    expect(steps).toBe(0);
    expect(result.accumulator).toBe(0);
  });
});
