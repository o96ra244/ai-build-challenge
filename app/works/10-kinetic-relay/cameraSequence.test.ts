import { describe, expect, it } from "vitest";

import { getCameraPreset, getFocusCamera, getHeroCamera, interpolateCamera } from "./cameraSequence";

describe("cameraSequence", () => {
  it("uses a wider mobile hero framing", () => {
    const desktop = getHeroCamera(1440, 900);
    const mobile = getHeroCamera(390, 844);
    expect(mobile.position[2]).toBeGreaterThan(desktop.position[2]);
    expect(mobile.fov).toBeGreaterThan(desktop.fov);
  });

  it("has distinct focus presets for all three routes", () => {
    expect(getFocusCamera("A", 1440, 900).target[0]).toBeLessThan(0);
    expect(getFocusCamera("B", 1440, 900).target[0]).toBe(0);
    expect(getFocusCamera("C", 1440, 900).target[0]).toBeGreaterThan(0);
  });

  it("returns to the hero shot for ready, complete, or reduced motion", () => {
    expect(getCameraPreset("B", "ready", 1440, 900, false)).toEqual(getHeroCamera(1440, 900));
    expect(getCameraPreset("B", "complete", 1440, 900, false)).toEqual(getHeroCamera(1440, 900));
    expect(getCameraPreset("B", "running", 1440, 900, true)).toEqual(getHeroCamera(1440, 900));
  });

  it("interpolates a finite camera attention move", () => {
    const hero = getHeroCamera(1440, 900);
    const focus = getFocusCamera("A", 1440, 900);
    const middle = interpolateCamera(hero, focus, 0.5);
    expect(middle.position[0]).toBeGreaterThan(focus.position[0]);
    expect(middle.position[0]).toBeLessThan(hero.position[0]);
    expect(middle.position.every(Number.isFinite)).toBe(true);
  });
});
