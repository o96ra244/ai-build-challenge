import { describe, expect, it } from "vitest";

import {
  getCameraFraming,
  getModelBounds,
  getModelNormalization,
  getOrientedModelBounds,
} from "./modelNormalization";

describe("modelNormalization", () => {
  it("calculates finite bounds, size, and center", () => {
    const bounds = getModelBounds([-2, 0, 1, 4, 8, 7, 0, 3, 5]);
    expect(bounds.min).toEqual([-2, 0, 1]);
    expect(bounds.max).toEqual([4, 8, 7]);
    expect(bounds.size).toEqual([6, 8, 6]);
    expect(bounds.center).toEqual([1, 4, 4]);
    expect(bounds.maxDimension).toBe(8);
  });

  it("protects empty and non-finite bounds", () => {
    const bounds = getModelBounds([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]);
    expect(bounds.min).toEqual([0, 0, 0]);
    expect(bounds.max).toEqual([0, 0, 0]);
    expect(bounds.size).toEqual([0, 0, 0]);
  });

  it("orients source Z-up coordinates into world Y-up coordinates", () => {
    const source = getModelBounds([0, 0, 0, 10, 4, 30]);
    const oriented = getOrientedModelBounds(source);
    expect(oriented.size).toEqual([10, 30, 4]);
    expect(oriented.min[2]).toBe(-4);
    expect(oriented.max[2]).toBe(0);
  });

  it("normalizes height and centers the sculpture on the pedestal", () => {
    const source = getModelBounds([0, 0, 0, 10, 4, 30]);
    const transform = getModelNormalization(source, 4.8);
    expect(transform.rotationX).toBeCloseTo(-Math.PI / 2);
    expect(transform.scale).toBeCloseTo(0.16);
    expect(transform.translation[1]).toBe(0);
    expect(transform.translation.every(Number.isFinite)).toBe(true);
  });

  it("uses a wider, farther mobile camera framing", () => {
    const desktop = getCameraFraming(1440, 900);
    const mobile = getCameraFraming(390, 844);
    expect(mobile.position[2]).toBeGreaterThan(desktop.position[2]);
    expect(mobile.fov).toBeGreaterThan(desktop.fov);
  });
});
