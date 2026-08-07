import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const assetPath = path.join(process.cwd(), "public/models/09-thinker/the-thinker-optimized.stl");
const attributionPath = path.join(process.cwd(), "public/models/09-thinker/ATTRIBUTION.md");

describe("The Thinker asset", () => {
  it("includes a finite optimized STL below the 6MB limit", () => {
    const asset = fs.readFileSync(assetPath);
    expect(asset.byteLength).toBeGreaterThan(0);
    expect(asset.byteLength).toBeLessThanOrEqual(6 * 1024 * 1024);
    expect(asset.byteLength).toBe(3_518_884);
    expect(asset.readUInt32LE(80)).toBe(70_376);
  });

  it("includes attribution, source, license, and modifications", () => {
    const attribution = fs.readFileSync(attributionPath, "utf8");
    expect(attribution).toContain("Scan the World");
    expect(attribution).toContain("CC BY-SA 4.0");
    expect(attribution).toContain("commons.wikimedia.org/wiki/File");
    expect(attribution).toContain("Polygon reduction");
    expect(attribution).toContain("binary STL");
    expect(attribution).toContain("not an official");
  });
});
