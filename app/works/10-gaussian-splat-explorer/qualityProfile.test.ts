import { describe, expect, it } from "vitest";

import { getQualityProfile } from "./qualityProfile";

describe("Gaussian Splat quality profile", () => {
  it("caps a wider viewport at 1.5 DPR", () => {
    expect(getQualityProfile(1440, 900, 3)).toMatchObject({
      isMobile: false,
      pixelRatioCap: 1.5,
      pixelRatio: 1.5,
    });
  });

  it("caps a narrow viewport at 1 DPR", () => {
    expect(getQualityProfile(390, 844, 3)).toMatchObject({
      isMobile: true,
      pixelRatioCap: 1,
      pixelRatio: 1,
    });
  });

  it("keeps a DPR at or below one unchanged", () => {
    expect(getQualityProfile(390, 844, 0.8).pixelRatio).toBe(0.8);
    expect(getQualityProfile(1440, 900, 1).pixelRatio).toBe(1);
  });

  it("recomputes the profile when the viewport crosses the mobile threshold", () => {
    expect(getQualityProfile(800, 600, 2).pixelRatioCap).toBe(1.5);
    expect(getQualityProfile(600, 600, 2).pixelRatioCap).toBe(1);
  });
});
