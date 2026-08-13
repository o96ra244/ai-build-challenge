import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const assetPath = path.join(process.cwd(), "public/works/10-gaussian-splat-explorer/tomatoes.v4.spz");
const attributionPath = path.join(process.cwd(), "public/works/10-gaussian-splat-explorer/ATTRIBUTION.md");
const provenancePath = path.join(process.cwd(), "app/works/10-gaussian-splat-explorer/vendor/three-r186-preview/PROVENANCE.md");

function getGitBlobSha(bytes: Buffer): string {
  const header = Buffer.from(`blob ${bytes.byteLength}\0`);
  return createHash("sha1").update(Buffer.concat([header, bytes])).digest("hex");
}

describe("Work 10 SPZ asset provenance", () => {
  it("keeps the official SPZ v4 asset byte-for-byte identified", () => {
    const asset = readFileSync(assetPath);
    expect(asset.byteLength).toBe(9_360_535);
    expect(getGitBlobSha(asset)).toBe("87fc51c424f387ec6830be2b4af5c62d9dc8d1cc");
  });

  it("keeps the author, source, and CC BY 4.0 attribution record", () => {
    const attribution = readFileSync(attributionPath, "utf8");
    expect(attribution).toContain("Grail");
    expect(attribution).toContain("https://superspl.at/scene/2826d2c0");
    expect(attribution).toContain("https://creativecommons.org/licenses/by/4.0/");
  });

  it("records the fixed upstream addon commit and import bridge", () => {
    const provenance = readFileSync(provenancePath, "utf8");
    expect(provenance).toContain("7f855a77b4b1733c923b8201fd1d202ea99b2d16");
    expect(provenance).toContain("three/addons/libs/");
    expect(provenance).toContain("CountingSort.js");
    expect(provenance).toContain("GaussianSplatMesh.js");
  });
});
