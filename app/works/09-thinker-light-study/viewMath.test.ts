import { describe, expect, it } from "vitest";

import {
  clampViewScale,
  DEFAULT_VIEW_TRANSFORM,
  resetViewTransform,
  updateViewTransform,
} from "./viewMath";

describe("viewMath", () => {
  it("clamps zoom to a bounded range", () => {
    expect(clampViewScale(0)).toBe(0.82);
    expect(clampViewScale(2)).toBe(1.2);
    expect(clampViewScale(Number.NaN)).toBe(1);
  });

  it("updates rotation and zoom without allowing extreme pitch", () => {
    const next = updateViewTransform(DEFAULT_VIEW_TRANSFORM, { yaw: 0.4, pitch: 1, scale: -1.9 });
    expect(next.yaw).toBeCloseTo(0.4);
    expect(next.pitch).toBeCloseTo(0.24);
    expect(next.scale).toBeCloseTo(0.82);
  });

  it("resets to the composed starting view", () => {
    expect(resetViewTransform()).toEqual(DEFAULT_VIEW_TRANSFORM);
  });
});
