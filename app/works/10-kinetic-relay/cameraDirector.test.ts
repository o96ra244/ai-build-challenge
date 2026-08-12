import { describe, expect, it } from "vitest";

import { clampTarget, getFollowTarget, getHomeCamera, interpolateCamera, ORBIT_TARGET_BOUNDS } from "./cameraDirector";
import { CHAIN_STAGES } from "./chainSequence";

describe("cameraDirector", () => {
  it("provides a wide home shot and bounded mobile variant", () => {
    expect(getHomeCamera(1440, 900).target[0]).toBeCloseTo(0.1);
    expect(getHomeCamera(390, 844).fov).toBeGreaterThan(getHomeCamera(1440, 900).fov);
  });

  it("keeps follow targets inside the room bounds", () => {
    const target = getFollowTarget(CHAIN_STAGES[CHAIN_STAGES.length - 1]!.id);
    const clamped = clampTarget(target);
    expect(clamped[0]).toBeGreaterThanOrEqual(ORBIT_TARGET_BOUNDS.min[0]);
    expect(clamped[1]).toBeLessThanOrEqual(ORBIT_TARGET_BOUNDS.max[1]);
  });

  it("interpolates HOME/FOLLOW camera values without invalid numbers", () => {
    const camera = interpolateCamera(getHomeCamera(1440, 900), getHomeCamera(390, 844), 0.5);
    expect(camera.position.every(Number.isFinite)).toBe(true);
    expect(camera.target.every(Number.isFinite)).toBe(true);
    expect(camera.minDistance).toBeGreaterThan(0);
  });
});
