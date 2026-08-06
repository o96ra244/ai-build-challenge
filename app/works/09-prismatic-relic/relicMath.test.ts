import { describe, expect, it } from "vitest";

import {
  getDrawingBufferSize,
  getQualityProfile,
  getTransitionProgress,
  normalizePointer,
  smoothPointer,
} from "./relicMath";

describe("relicMath", () => {
  it("normalizes the canvas center and corners", () => {
    const rect = { left: 10, top: 20, width: 200, height: 100 };
    expect(normalizePointer(110, 70, rect)).toEqual({ x: 0, y: 0 });
    expect(normalizePointer(10, 20, rect)).toEqual({ x: -1, y: 1 });
    expect(normalizePointer(210, 120, rect)).toEqual({ x: 1, y: -1 });
  });

  it("clamps out-of-range pointer positions and protects zero-sized rectangles", () => {
    expect(normalizePointer(-100, 500, { left: 0, top: 0, width: 100, height: 100 })).toEqual({ x: -1, y: -1 });
    expect(normalizePointer(10, 20, { left: 10, top: 20, width: 0, height: 100 })).toEqual({ x: 0, y: 0 });
  });

  it("smooths toward a target without overshooting", () => {
    const next = smoothPointer({ x: 0, y: 0 }, { x: 1, y: -1 }, 0.16);
    expect(next.x).toBeGreaterThan(0);
    expect(next.x).toBeLessThan(1);
    expect(next.y).toBeLessThan(0);
  });

  it("selects a low-cost mobile quality profile", () => {
    const profile = getQualityProfile(390, 844, 3);
    expect(profile.level).toBe("low");
    expect(profile.particleCount).toBeGreaterThan(0);
    expect(profile.geometryDetail).toBeGreaterThan(0);
  });

  it("caps drawing buffer pixels for large and high-DPR screens", () => {
    const profile = getQualityProfile(1440, 900, 3);
    const buffer = getDrawingBufferSize(1440, 900, 3, profile);
    expect(buffer.width * buffer.height).toBeLessThanOrEqual(profile.maxPixels);
    expect(buffer.pixelRatio).toBeGreaterThan(0);
  });

  it("clamps preset transition progress and shortens reduced motion", () => {
    expect(getTransitionProgress(-10, 1000, false)).toBe(0);
    expect(getTransitionProgress(500, 1000, false)).toBe(0.5);
    expect(getTransitionProgress(500, 1000, true)).toBe(1);
    expect(getTransitionProgress(1500, 1000, false)).toBe(1);
  });
});
