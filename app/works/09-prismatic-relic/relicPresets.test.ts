import { describe, expect, it } from "vitest";

import {
  getPreset,
  getPresetTransitionDuration,
  interpolatePreset,
  RELIC_PRESETS,
} from "./relicPresets";

function values(value: unknown): number[] {
  if (typeof value === "number") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(values);
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(values);
  }
  return [];
}

describe("relicPresets", () => {
  it("contains the three unique presets", () => {
    expect(RELIC_PRESETS.map((preset) => preset.id)).toEqual(["eclipse", "aurora", "ember"]);
    expect(new Set(RELIC_PRESETS.map((preset) => preset.id)).size).toBe(3);
  });

  it("keeps all numeric parameters finite and colors in range", () => {
    for (const preset of RELIC_PRESETS) {
      expect(values(preset).every(Number.isFinite)).toBe(true);
      const colors = [
        preset.background.top,
        preset.background.middle,
        preset.background.bottom,
        preset.shell.colorA,
        preset.shell.colorB,
        preset.core.colorA,
        preset.core.colorB,
      ];
      expect(colors.flat().every((component) => component >= 0 && component <= 1)).toBe(true);
    }
  });

  it("interpolates at 0, 0.5, and 1 while clamping", () => {
    const from = getPreset("eclipse");
    const to = getPreset("aurora");
    expect(interpolatePreset(from, to, 0).shell.transmission).toBe(from.shell.transmission);
    expect(interpolatePreset(from, to, 1).shell.transmission).toBe(to.shell.transmission);
    expect(interpolatePreset(from, to, 0.5).shell.transmission).toBeCloseTo(
      (from.shell.transmission + to.shell.transmission) / 2,
    );
    expect(interpolatePreset(from, to, -1).camera.fov).toBe(from.camera.fov);
    expect(interpolatePreset(from, to, 2).camera.fov).toBe(to.camera.fov);
  });

  it("uses a short transition for reduced motion", () => {
    expect(getPresetTransitionDuration(false)).toBeGreaterThan(800);
    expect(getPresetTransitionDuration(false)).toBeLessThan(1400);
    expect(getPresetTransitionDuration(true)).toBeLessThan(200);
  });
});
