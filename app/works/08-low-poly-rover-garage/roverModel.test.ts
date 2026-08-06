import { describe, expect, it } from "vitest";

import {
  CABIN_MODULES,
  FRONT_MODULES,
  getCameraPreset,
  getCombinationCount,
  getSelectionLabel,
  INITIAL_SELECTION,
  normalizeSelection,
  REAR_MODULES,
  ROVER_MODULES,
  updateSelection,
} from "./roverModel";

describe("roverModel", () => {
  it("defines 12 unique modules as 4 x 4 x 4 = 64 configurations", () => {
    expect(FRONT_MODULES).toHaveLength(4);
    expect(CABIN_MODULES).toHaveLength(4);
    expect(REAR_MODULES).toHaveLength(4);
    expect(ROVER_MODULES).toHaveLength(12);
    expect(getCombinationCount()).toBe(64);
    expect(new Set(ROVER_MODULES.map((module) => module.id)).size).toBe(12);
    expect(new Set(ROVER_MODULES.map((module) => module.label)).size).toBe(12);
    expect(ROVER_MODULES.every((module) => module.category === "front" || module.category === "cabin" || module.category === "rear")).toBe(true);
  });

  it("keeps the initial selection valid and normalizes unknown ids", () => {
    expect(normalizeSelection({ front: "unknown", cabin: "bubble", rear: "coil" })).toEqual({
      ...INITIAL_SELECTION,
      cabin: "bubble",
      rear: "coil",
    });
    expect(updateSelection(INITIAL_SELECTION, "front", "sensor").front).toBe("sensor");
    expect(updateSelection(INITIAL_SELECTION, "rear", "missing")).toEqual(INITIAL_SELECTION);
    expect(getSelectionLabel({ front: "winch", cabin: "capsule", rear: "tank" })).toBe("WINCH / CAPSULE / TOOL TANK");
  });

  it("returns finite mobile and desktop camera presets", () => {
    const desktop = getCameraPreset(1440, 900);
    const mobile = getCameraPreset(390, 844);
    expect(desktop.fov).toBeLessThan(mobile.fov);
    expect(desktop.minDistance).toBeLessThan(desktop.maxDistance);
    expect(mobile.minDistance).toBeLessThan(mobile.maxDistance);
    expect([...desktop.position, ...desktop.target, ...mobile.position, ...mobile.target].every(Number.isFinite)).toBe(true);
  });
});
