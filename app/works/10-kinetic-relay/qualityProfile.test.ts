import { describe, expect, it } from "vitest";

import { getDrawingBufferSize, getQualityProfile } from "./qualityProfile";

describe("qualityProfile", () => {
  it("keeps desktop geometry quality and a bounded high-DPR buffer", () => {
    const profile = getQualityProfile(1440, 900, 3);
    const buffer = getDrawingBufferSize(1440, 900, 3, profile);
    expect(profile.level).toBe("desktop");
    expect(profile.shadowMapSize).toBe(2048);
    expect(buffer.width * buffer.height).toBeLessThanOrEqual(profile.maxPixels * 1.02);
    expect(buffer.pixelRatio).toBeGreaterThan(0);
  });

  it("uses a lower cost mobile profile without swapping the geometry style", () => {
    const profile = getQualityProfile(390, 844, 3);
    expect(profile.level).toBe("mobile");
    expect(profile.shadowMapSize).toBe(768);
    expect(profile.railRadialSegments).toBeGreaterThanOrEqual(16);
    expect(profile.maxPixels).toBeLessThan(1_200_000);
  });
});
