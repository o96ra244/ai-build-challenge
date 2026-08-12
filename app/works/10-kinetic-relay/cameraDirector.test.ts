import { describe, expect, it } from "vitest";

import { getHeroCamera, getStageCamera, interpolateCamera } from "./cameraDirector";

describe("cameraDirector", () => {
  it("keeps the ready hero shot wide enough for the goal bell", () => {
    expect(getHeroCamera(1440, 900).target[0]).toBeCloseTo(0.15);
    expect(getHeroCamera(390, 844).fov).toBeGreaterThan(getHeroCamera(1440, 900).fov);
  });

  it("holds a wide shot when reduced motion is enabled", () => {
    expect(getStageCamera("marble", 1440, 900, true)).toEqual(getHeroCamera(1440, 900));
  });

  it("interpolates camera presets without invalid values", () => {
    const camera = interpolateCamera(getHeroCamera(1440, 900), getStageCamera("bell", 1440, 900, false), 0.5);
    expect(camera.position.every(Number.isFinite)).toBe(true);
    expect(camera.target.every(Number.isFinite)).toBe(true);
  });
});
