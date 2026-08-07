import { describe, expect, it } from "vitest";

import {
  getLightingPreset,
  getLightingTransitionDuration,
  interpolateLightingPreset,
  LIGHTING_PRESETS,
} from "./lightingPresets";

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

describe("lightingPresets", () => {
  it("contains GALLERY, CHIAROSCURO, and SPECTRUM exactly once", () => {
    expect(LIGHTING_PRESETS.map((preset) => preset.id)).toEqual(["gallery", "chiaroscuro", "spectrum"]);
    expect(new Set(LIGHTING_PRESETS.map((preset) => preset.id)).size).toBe(3);
    expect(getLightingPreset("gallery").id).toBe("gallery");
  });

  it("keeps lighting values finite and bounded", () => {
    for (const preset of LIGHTING_PRESETS) {
      expect(values(preset).every(Number.isFinite)).toBe(true);
      expect(preset.exposure).toBeGreaterThan(0.5);
      expect(preset.exposure).toBeLessThan(1.2);
      expect(preset.key.intensity).toBeGreaterThan(0);
    }
  });

  it("uses materially different key-light types and directions", () => {
    expect(getLightingPreset("gallery").key.kind).toBe("directional");
    expect(getLightingPreset("chiaroscuro").key.kind).toBe("spot");
    expect(getLightingPreset("gallery").key.position).not.toEqual(getLightingPreset("spectrum").key.position);
    expect(getLightingPreset("gallery").bloomStrength).toBeLessThan(0.02);
    expect(getLightingPreset("chiaroscuro").bloomStrength).toBe(0);
  });

  it("interpolates endpoints and midpoint while clamping", () => {
    const from = getLightingPreset("gallery");
    const to = getLightingPreset("spectrum");
    expect(interpolateLightingPreset(from, to, 0).exposure).toBe(from.exposure);
    expect(interpolateLightingPreset(from, to, 1).exposure).toBe(to.exposure);
    expect(interpolateLightingPreset(from, to, 0.5).fill.intensity).toBeCloseTo(
      (from.fill.intensity + to.fill.intensity) / 2,
    );
    expect(interpolateLightingPreset(from, to, -1).key.position).toEqual(from.key.position);
    expect(interpolateLightingPreset(from, to, 2).key.position).toEqual(to.key.position);
  });

  it("uses a short reduced-motion transition within the requested range", () => {
    expect(getLightingTransitionDuration(false)).toBeGreaterThan(800);
    expect(getLightingTransitionDuration(false)).toBeLessThan(1400);
    expect(getLightingTransitionDuration(true)).toBeLessThan(200);
  });
});
