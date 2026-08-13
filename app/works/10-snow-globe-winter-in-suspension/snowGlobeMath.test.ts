import { describe, expect, it } from "vitest";

import {
  EMPTY_ACCUMULATION,
  classifyGesture,
  getDrawingBufferSize,
  getFlowVector,
  getLayerConfig,
  getQualityProfile,
  getShakeImpulse,
  releaseAccumulation,
  updateAccumulation,
} from "./snowGlobeMath";

describe("snow globe interaction", () => {
  it("separates a tap, a slow turn, and a flick", () => {
    expect(classifyGesture({ distance: 4, durationMs: 120, speed: 0.03 })).toBe("tap");
    expect(classifyGesture({ distance: 80, durationMs: 960, speed: 0.08 })).toBe("slow-drag");
    expect(classifyGesture({ distance: 180, durationMs: 220, speed: 0.82 })).toBe("flick");
  });

  it("turns a drag delta into a bounded shake impulse", () => {
    expect(getShakeImpulse(340, -220, 80)).toEqual({ x: 1, y: 1, strength: 2.4 });
    expect(getShakeImpulse(Number.NaN, Number.POSITIVE_INFINITY, 0)).toEqual({
      x: 0,
      y: 0,
      strength: 0.48,
    });
  });
});

describe("snow globe quality profiles", () => {
  it("reduces particle counts and DPR on a narrow viewport", () => {
    const profile = getQualityProfile(390, 844, 3);

    expect(profile.level).toBe("low");
    expect(profile.pixelRatio).toBe(1.1);
    expect(profile.snowCount).toBeLessThan(100);
    expect(profile.dustCount).toBeGreaterThan(profile.snowCount);
  });

  it("caps the drawing buffer by the profile pixel budget", () => {
    const profile = getQualityProfile(1440, 900, 2);
    const buffer = getDrawingBufferSize(1440, 900, 2, profile);

    expect(buffer.width * buffer.height).toBeLessThanOrEqual(profile.maxPixels);
    expect(buffer.pixelRatio).toBeLessThanOrEqual(profile.pixelRatio);
  });
});

describe("particle layers and flow", () => {
  it("gives snow, glitter, and dust different behavior profiles", () => {
    const snow = getLayerConfig("snow");
    const glitter = getLayerConfig("glitter");
    const dust = getLayerConfig("dust");

    expect(snow.radius).toBeGreaterThan(glitter.radius);
    expect(glitter.swirlScale).toBeGreaterThan(snow.swirlScale);
    expect(dust.gravity).toBeLessThan(snow.gravity);
    expect(dust.opacity).toBeLessThan(snow.opacity);
  });

  it("keeps the particle flow finite and responsive to swirl", () => {
    const still = getFlowVector([0.8, 0.1, 0.4], [0.2, 0, -0.1], 0, "snow", 1, 0.3);
    const stirred = getFlowVector([0.8, 0.1, 0.4], [0.2, 0, -0.1], 1.3, "snow", 1, 0.3);

    expect(stirred[0]).not.toBeCloseTo(still[0]);
    expect(stirred.every(Number.isFinite)).toBe(true);
  });
});

describe("snow accumulation", () => {
  it("builds on impact and caps at one", () => {
    const afterRoofHit = updateAccumulation(EMPTY_ACCUMULATION, "roof", 2, 0.1);
    const fullGround = updateAccumulation(
      { roof: 1, branches: 1, ground: 0.99 },
      "ground",
      99,
      1,
    );

    expect(afterRoofHit.roof).toBeGreaterThan(0);
    expect(fullGround.ground).toBe(1);
  });

  it("sheds roof and branches more strongly than the ground on the next shake", () => {
    const released = releaseAccumulation({ roof: 1, branches: 0.8, ground: 1 }, 0.9);

    expect(released.roof).toBeLessThan(0.5);
    expect(released.branches).toBeLessThan(0.4);
    expect(released.ground).toBeGreaterThan(released.roof);
  });
});
