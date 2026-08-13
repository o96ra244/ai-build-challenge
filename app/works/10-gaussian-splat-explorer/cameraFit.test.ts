import { describe, expect, it } from "vitest";

import { getCameraFit, getViewerFov } from "./cameraFit";

describe("Gaussian Splat camera fit", () => {
  it("fits a valid bounding sphere with finite camera limits", () => {
    const fit = getCameraFit({ center: [0.4, 2.2, 0.8], radius: 8.3 }, 16 / 10);
    expect(fit.target).toEqual([0.4, 2.2, 0.8]);
    expect(fit.distance).toBeGreaterThan(8.3);
    expect(fit.minDistance).toBeGreaterThan(0);
    expect(fit.maxDistance).toBeGreaterThan(fit.distance);
    expect([...fit.position, fit.distance, fit.minDistance, fit.maxDistance].every(Number.isFinite)).toBe(true);
  });

  it("keeps very small or invalid radii finite", () => {
    const fit = getCameraFit({ center: [0, 0, 0], radius: Number.NaN }, 0);
    expect([...fit.position, fit.distance, fit.minDistance, fit.maxDistance].every(Number.isFinite)).toBe(true);
    expect(fit.maxDistance).toBeGreaterThan(fit.minDistance);
  });

  it("uses a wider mobile field of view and recalculates for aspect", () => {
    const desktop = getCameraFit({ center: [0, 0, 0], radius: 1 }, 1440 / 900, getViewerFov(1440));
    const mobile = getCameraFit({ center: [0, 0, 0], radius: 1 }, 390 / 844, getViewerFov(390));
    expect(getViewerFov(390)).toBeGreaterThan(getViewerFov(1440));
    expect(mobile.distance).toBeGreaterThan(desktop.distance);
  });
});
