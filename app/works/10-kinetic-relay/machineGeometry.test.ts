import { describe, expect, it } from "vitest";

import { createGearProfile } from "./machineGeometry";

describe("machineGeometry", () => {
  it("creates actual repeated gear teeth rather than a cylinder", () => {
    const profile = createGearProfile(16, 0.5, 0.9, 1.16);
    expect(profile).toHaveLength(16 * 6);
    const radii = profile.map(([x, y]) => Math.hypot(x, y));
    expect(Math.max(...radii)).toBeCloseTo(1.16);
    expect(Math.min(...radii)).toBeCloseTo(0.5);
    expect(new Set(radii.map((radius) => radius.toFixed(2))).size).toBeGreaterThan(2);
  });
});
