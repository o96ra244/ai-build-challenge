import { describe, expect, it } from "vitest";

import {
  getDynamicYardObjects,
  getFixedYardObjects,
  getRampVertices,
  getYardZone,
  isInsideYardBounds,
  RAMP_INDICES,
  YARD_BOUNDS,
  YARD_OBJECTS,
} from "./testYard";

describe("testYard", () => {
  it("keeps every definition finite and inside the 48 by 36 yard", () => {
    expect(YARD_BOUNDS.maxX - YARD_BOUNDS.minX).toBe(48);
    expect(YARD_BOUNDS.maxZ - YARD_BOUNDS.minZ).toBe(36);
    expect(new Set(YARD_OBJECTS.map((object) => object.id)).size).toBe(YARD_OBJECTS.length);
    for (const object of YARD_OBJECTS) {
      expect(object.position.every(Number.isFinite)).toBe(true);
      expect(object.rotation.every(Number.isFinite)).toBe(true);
      expect(object.scale.every((value) => Number.isFinite(value) && value > 0)).toBe(true);
      if (object.bodyType === "fixed" || object.bodyType === "dynamic") {
        expect(object.collider).not.toBeNull();
      }
      if (object.collider?.type === "ramp") {
        expect(getRampVertices(object.collider)).toHaveLength(18);
      }
    }
  });

  it("contains the requested fixed and dynamic test pieces", () => {
    expect(getDynamicYardObjects().filter((object) => object.kind === "crate")).toHaveLength(3);
    expect(getFixedYardObjects().filter((object) => object.kind === "rock")).toHaveLength(2);
    expect(YARD_OBJECTS.some((object) => object.kind === "slope")).toBe(true);
    expect(YARD_OBJECTS.some((object) => object.kind === "whoop")).toBe(true);
    expect(YARD_OBJECTS.some((object) => object.kind === "log")).toBe(true);
    expect(YARD_OBJECTS.some((object) => object.kind === "jump-ramp")).toBe(true);
    expect(YARD_OBJECTS.filter((object) => object.kind === "fence")).toHaveLength(4);
    expect(YARD_OBJECTS.some((object) => object.kind === "start-pad")).toBe(true);
    expect(RAMP_INDICES.length % 3).toBe(0);
  });

  it("labels the test zones without adding exploration state", () => {
    expect(getYardZone(0, 14).surface).toBe("start-pad");
    expect(getYardZone(0, 7).surface).toBe("slope");
    expect(getYardZone(8, 7).surface).toBe("whoops");
    expect(getYardZone(100, 0).surface).toBe("boundary");
    expect(isInsideYardBounds(0, 0)).toBe(true);
    expect(isInsideYardBounds(100, 0)).toBe(false);
  });
});
