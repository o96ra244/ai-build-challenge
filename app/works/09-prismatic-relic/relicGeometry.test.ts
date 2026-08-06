import { describe, expect, it } from "vitest";

import {
  generateRelicPositions,
  getRelicBounds,
  getRelicVertexCount,
} from "./relicGeometry";

describe("relicGeometry", () => {
  it("is deterministic for a seed and changes for another seed", () => {
    const first = generateRelicPositions(903, 2);
    const same = generateRelicPositions(903, 2);
    const different = generateRelicPositions(904, 2);
    expect(Array.from(first)).toEqual(Array.from(same));
    expect(Array.from(first)).not.toEqual(Array.from(different));
  });

  it("keeps the expected vertex count and finite coordinates", () => {
    const positions = generateRelicPositions(903, 3);
    expect(positions.length / 3).toBe(getRelicVertexCount(3));
    expect(Array.from(positions).every(Number.isFinite)).toBe(true);
  });

  it("keeps a bounded, asymmetric silhouette", () => {
    const bounds = getRelicBounds(generateRelicPositions(903, 3));
    expect(bounds.maxRadius).toBeLessThan(1.7);
    expect(bounds.maxRadius).toBeGreaterThan(0.9);
    expect(bounds.min[0]).not.toBeCloseTo(-bounds.max[0], 2);
    expect(bounds.min[1]).not.toBeCloseTo(-bounds.max[1], 2);
  });

  it("uses a distinct interior core formula", () => {
    const shell = generateRelicPositions(903, 2, "outer");
    const core = generateRelicPositions(903, 2, "core");
    expect(Array.from(shell)).not.toEqual(Array.from(core));
    expect(getRelicBounds(core).maxRadius).toBeLessThan(getRelicBounds(shell).maxRadius);
  });
});
