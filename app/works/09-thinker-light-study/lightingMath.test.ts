import { describe, expect, it } from "vitest";

import {
  getDrawingBufferSize,
  getPointerLightStrength,
  getQualityProfile,
  getTransitionProgress,
  nudgePointer,
  normalizePointer,
  shouldAnimateLighting,
  smoothPointer,
} from "./lightingMath";

describe("lightingMath", () => {
  it("normalizes the canvas center and corners", () => {
    const rect = { left: 10, top: 20, width: 200, height: 100 };
    expect(normalizePointer(110, 70, rect)).toEqual({ x: 0, y: 0 });
    expect(normalizePointer(10, 20, rect)).toEqual({ x: -1, y: 1 });
    expect(normalizePointer(210, 120, rect)).toEqual({ x: 1, y: -1 });
  });

  it("clamps out-of-range pointers and protects zero-size rectangles", () => {
    expect(normalizePointer(-100, 500, { left: 0, top: 0, width: 100, height: 100 })).toEqual({ x: -1, y: -1 });
    expect(normalizePointer(10, 20, { left: 10, top: 20, width: 0, height: 100 })).toEqual({ x: 0, y: 0 });
  });

  it("moves the light by a fixed keyboard step and clamps at the edges", () => {
    expect(nudgePointer({ x: 0, y: 0 }, "up")).toEqual({ x: 0, y: 0.2 });
    expect(nudgePointer({ x: 0, y: 0 }, "down")).toEqual({ x: 0, y: -0.2 });
    expect(nudgePointer({ x: 0, y: 0 }, "left")).toEqual({ x: -0.2, y: 0 });
    expect(nudgePointer({ x: 0, y: 0 }, "right")).toEqual({ x: 0.2, y: 0 });
    expect(nudgePointer({ x: 0.8, y: -0.9 }, "right")).toEqual({ x: 1, y: -0.9 });
    expect(nudgePointer({ x: -0.8, y: 0.9 }, "up")).toEqual({ x: -0.8, y: 1 });
    expect(nudgePointer({ x: 0.8, y: -0.9 }, "center")).toEqual({ x: 0, y: 0 });
  });

  it("normalizes invalid keyboard positions before applying a nudge", () => {
    expect(nudgePointer({ x: Number.NaN, y: Number.POSITIVE_INFINITY }, "left")).toEqual({ x: -0.2, y: 0 });
    expect(nudgePointer({ x: 0, y: 0 }, "right", Number.POSITIVE_INFINITY)).toEqual({ x: 0.2, y: 0 });
  });

  it("maps pointer distance to a readable light-strength range", () => {
    expect(getPointerLightStrength({ x: 0, y: 0 })).toBeCloseTo(1.12);
    expect(getPointerLightStrength({ x: 1, y: 1 })).toBeCloseTo(1.8);
    expect(getPointerLightStrength({ x: 3, y: -2 })).toBeCloseTo(1.8);
  });

  it("smooths toward a target without overshooting", () => {
    const next = smoothPointer({ x: 0, y: 0 }, { x: 1, y: -1 }, 0.16);
    expect(next.x).toBeGreaterThan(0);
    expect(next.x).toBeLessThan(1);
    expect(next.y).toBeLessThan(0);
  });

  it("uses a low-cost mobile quality profile with a shadow cap", () => {
    const profile = getQualityProfile(390, 844, 3);
    expect(profile.level).toBe("low");
    expect(profile.shadowMapSize).toBe(512);
    expect(profile.maxPixels).toBeLessThan(1_000_000);
  });

  it("caps the drawing buffer for large and high-DPR screens", () => {
    const profile = getQualityProfile(1440, 900, 3);
    const buffer = getDrawingBufferSize(1440, 900, 3, profile);
    expect(buffer.width * buffer.height).toBeLessThanOrEqual(profile.maxPixels);
    expect(buffer.pixelRatio).toBeGreaterThan(0);
  });

  it("shortens reduced-motion transitions", () => {
    expect(getTransitionProgress(-10, 1000, false)).toBe(0);
    expect(getTransitionProgress(500, 1000, false)).toBe(0.5);
    expect(getTransitionProgress(500, 1000, true)).toBe(1);
    expect(getTransitionProgress(1500, 1000, false)).toBe(1);
  });

  it("stops a settled HOLD LIGHT state before checking pointer activity", () => {
    expect(shouldAnimateLighting({
      pageVisible: true,
      inViewport: true,
      holdLight: true,
      holdSettling: false,
      transitionActive: true,
      pointerNeedsRender: true,
      pointerDistance: 0.5,
    })).toBe(false);
    expect(shouldAnimateLighting({
      pageVisible: true,
      inViewport: true,
      holdLight: true,
      holdSettling: true,
      transitionActive: false,
      pointerNeedsRender: false,
      pointerDistance: 0.5,
    })).toBe(true);
  });
});
