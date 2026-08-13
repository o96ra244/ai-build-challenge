import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const assetPath = path.join(process.cwd(), "public/works/10-gaussian-splat-explorer/japanese-bee.v4.spz");
const backgroundPath = path.join(process.cwd(), "public/works/10-gaussian-splat-explorer/meadow-2k.jpg");
const attributionPath = path.join(process.cwd(), "public/works/10-gaussian-splat-explorer/ATTRIBUTION.md");
const provenancePath = path.join(process.cwd(), "app/works/10-gaussian-splat-explorer/vendor/three-r186-preview/PROVENANCE.md");

function getGitBlobSha(bytes: Buffer): string {
  const header = Buffer.from(`blob ${bytes.byteLength}\0`);
  return createHash("sha1").update(Buffer.concat([header, bytes])).digest("hex");
}

function getJpegDimensions(bytes: Buffer): { readonly width: number; readonly height: number } {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) {
      continue;
    }
    const segmentLength = bytes.readUInt16BE(offset);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5),
      };
    }
    offset += segmentLength;
  }
  throw new Error("JPEG dimensions were not found.");
}

describe("Work 10 SPZ asset provenance", () => {
  it("keeps the converted Japanese Bee SPZ v4 asset byte-for-byte identified", () => {
    const asset = readFileSync(assetPath);
    expect(asset.byteLength).toBe(13_242_688);
    expect(getGitBlobSha(asset)).toBe("c22ecb6c62e8b54d3829942f526ba22c861926ac");
  });

  it("keeps the bee author, source, and CC BY 4.0 attribution record", () => {
    const attribution = readFileSync(attributionPath, "utf8");
    expect(attribution).toContain("yyouzhen");
    expect(attribution).toContain("Japanese Bee");
    expect(attribution).toContain("https://superspl.at/scene/ae58ed2c");
    expect(attribution).toContain("https://creativecommons.org/licenses/by/4.0/");
  });

  it("keeps the local Meadow equirectangular background and provenance", () => {
    const background = readFileSync(backgroundPath);
    const attribution = readFileSync(attributionPath, "utf8");
    expect(background.byteLength).toBe(553_041);
    expect(background.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(getJpegDimensions(background)).toEqual({ width: 2048, height: 1024 });
    expect(attribution).toContain("Meadow");
    expect(attribution).toContain("https://polyhaven.com/a/meadow");
    expect(attribution).toContain("CC0");
    expect(attribution).toContain("2048 × 1024");
  });

  it("records the fixed upstream addon commit and import bridge", () => {
    const provenance = readFileSync(provenancePath, "utf8");
    expect(provenance).toContain("7f855a77b4b1733c923b8201fd1d202ea99b2d16");
    expect(provenance).toContain("three/addons/libs/");
    expect(provenance).toContain("CountingSort.js");
    expect(provenance).toContain("GaussianSplatMesh.js");
  });
});
