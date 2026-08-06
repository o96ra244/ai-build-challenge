import { describe, expect, it } from "vitest";

import {
  CLIMBABLE_OBSTACLES,
  DYNAMIC_PROPS,
  FIXED_OBSTACLES,
  FRONTIER_AREAS,
  FRONTIER_BOUNDS,
  FRONTIER_DEPTH,
  FRONTIER_WIDTH,
  getFrontierArea,
  getFrontierHeight,
  getFrontierNormal,
  getHeightfieldIndex,
  HEIGHTFIELD_COLUMNS,
  HEIGHTFIELD_HEIGHTS,
  HEIGHTFIELD_ROWS,
  isInsideFrontierBounds,
  WAYSTONES,
  worldToMinimap,
} from "./frontierWorld";

describe("frontierWorld", () => {
  it("defines a fixed 320 by 240 field and the six required areas", () => {
    expect(FRONTIER_WIDTH).toBe(320);
    expect(FRONTIER_DEPTH).toBe(240);
    expect(FRONTIER_AREAS).toHaveLength(6);
    expect(WAYSTONES).toHaveLength(6);
    expect(CLIMBABLE_OBSTACLES.length).toBeGreaterThanOrEqual(10);
    expect(FIXED_OBSTACLES.length).toBeGreaterThanOrEqual(8);
    expect(DYNAMIC_PROPS.length).toBeGreaterThanOrEqual(12);
  });

  it("shares deterministic heightfield samples between geometry and collider data", () => {
    expect(HEIGHTFIELD_HEIGHTS.length).toBe(HEIGHTFIELD_ROWS * HEIGHTFIELD_COLUMNS);
    expect(getHeightfieldIndex(0, 0)).toBe(0);
    expect(getHeightfieldIndex(HEIGHTFIELD_COLUMNS - 1, HEIGHTFIELD_ROWS - 1)).toBe(HEIGHTFIELD_HEIGHTS.length - 1);
    const samples = [[-120, -80], [-72, 10], [36, -70], [105, 60], [3, 88]] as const;
    const heights = samples.map(([x, z]) => getFrontierHeight(x, z));
    expect(heights).toEqual(samples.map(([x, z]) => getFrontierHeight(x, z)));
    expect(new Set(heights).size).toBeGreaterThan(2);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(2);
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(Number.isFinite(getFrontierHeight(value, 0))).toBe(true);
      expect(getFrontierNormal(value, 0).every((component) => Number.isFinite(component))).toBe(true);
    }
  });

  it("keeps normals finite, smooth, and normalized", () => {
    const normal = getFrontierNormal(12.4, 64.8);
    expect(normal.every((component) => Number.isFinite(component))).toBe(true);
    expect(Math.hypot(...normal)).toBeGreaterThan(0.98);
    expect(Math.hypot(...normal)).toBeLessThan(1.02);
    expect(Math.abs(getFrontierHeight(12.4, 64.8) - getFrontierHeight(13.4, 64.8))).toBeLessThan(4);
  });

  it("resolves area, bounds, and minimap values for hostile positions", () => {
    expect(getFrontierArea(-112, -78).id).toBe("base-camp-meadow");
    expect(getFrontierArea(105, 60).id).toBe("ancient-stoneworks");
    expect(isInsideFrontierBounds(FRONTIER_BOUNDS.minX, FRONTIER_BOUNDS.minZ)).toBe(true);
    expect(isInsideFrontierBounds(FRONTIER_BOUNDS.minX - 1, 0)).toBe(false);
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const point = worldToMinimap(value, value);
      expect(point.every((component) => Number.isFinite(component))).toBe(true);
      expect(point.every((component) => component >= 0 && component <= 1)).toBe(true);
    }
  });
});
