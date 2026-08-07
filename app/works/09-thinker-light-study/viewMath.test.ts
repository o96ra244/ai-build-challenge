import { describe, expect, it } from "vitest";

import {
  clampViewPitch,
  clampViewScale,
  clampViewYaw,
  DEFAULT_VIEW_TRANSFORM,
  resetViewTransform,
  updateViewTransform,
} from "./viewMath";

describe("viewMath", () => {
  it("clamps zoom to a bounded range", () => {
    expect(clampViewScale(0)).toBe(0.9);
    expect(clampViewScale(2)).toBe(1.12);
    expect(clampViewScale(Number.NaN)).toBe(1);
  });

  it("clamps yaw, pitch, and scale to the exhibition bounds", () => {
    expect(clampViewYaw(-10)).toBe(-0.55);
    expect(clampViewYaw(10)).toBe(0.55);
    expect(clampViewYaw(Number.NaN)).toBe(0);
    expect(clampViewYaw(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampViewPitch(-10)).toBe(-0.1);
    expect(clampViewPitch(10)).toBe(0.1);
    expect(clampViewPitch(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it("updates rotation and zoom without allowing extreme view changes", () => {
    const next = updateViewTransform(DEFAULT_VIEW_TRANSFORM, { yaw: 0.4, pitch: 1, scale: -1.9 });
    expect(next.yaw).toBeCloseTo(0.4);
    expect(next.pitch).toBeCloseTo(0.1);
    expect(next.scale).toBeCloseTo(0.9);
  });

  it("keeps repeated operations at the yaw and scale boundaries", () => {
    let next = DEFAULT_VIEW_TRANSFORM;
    for (let index = 0; index < 20; index += 1) {
      next = updateViewTransform(next, { yaw: 0.2, scale: 0.2 });
    }
    expect(next.yaw).toBe(0.55);
    expect(next.pitch).toBe(0);
    expect(next.scale).toBe(1.12);

    next = updateViewTransform(next, { yaw: Number.POSITIVE_INFINITY, pitch: Number.NaN, scale: Number.NEGATIVE_INFINITY });
    expect(next).toEqual({ yaw: 0.55, pitch: 0, scale: 1.12 });
  });

  it("resets to the composed starting view", () => {
    expect(resetViewTransform()).toEqual(DEFAULT_VIEW_TRANSFORM);
  });
});
