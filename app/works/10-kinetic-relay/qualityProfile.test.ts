import { describe, expect, it } from "vitest";

import { getDrawingBufferSize, getQualityProfile } from "./qualityProfile";

describe("qualityProfile", () => {
  it("caps desktop DPR and pixels for a 30fps active render target", () => {
    const profile = getQualityProfile(1440, 900, 3);
    const buffer = getDrawingBufferSize(1440, 900, 3, profile);
    expect(profile.shadowMapSize).toBe(1024);
    expect(profile.targetFps).toBe(30);
    expect(buffer.width * buffer.height).toBeLessThanOrEqual(profile.maxPixels * 1.02);
  });

  it("uses a lower mobile buffer and one-step shadow profile", () => {
    const profile = getQualityProfile(390, 844, 3);
    expect(profile.level).toBe("mobile");
    expect(profile.shadowMapSize).toBe(512);
    expect(profile.maxPixels).toBeLessThan(700_000);
    expect(profile.maxSubsteps).toBe(2);
  });
});
