import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createRuntimeMetadata, formatFileSize } from "./metadata";

const pageSource = readFileSync(path.join(process.cwd(), "app/works/10-gaussian-splat-explorer/page.tsx"), "utf8");
const ogImage = readFileSync(path.join(process.cwd(), "public/og/10-gaussian-splat-explorer.png"));

describe("Work 10 SEO and social metadata", () => {
  it("keeps the production canonical and social card settings", () => {
    expect(pageSource).toContain("https://ai-build-challenge.vercel.app/works/10-gaussian-splat-explorer");
    expect(pageSource).toContain("Gaussian Splat Explorer | AI Build Challenge");
    expect(pageSource).toContain("Japanese Bee");
    expect(pageSource).toContain("Meadow");
    expect(pageSource).not.toContain("Tomatoes");
    expect(pageSource).toContain("SPZ v4");
    expect(pageSource).toContain("type: \"website\"");
    expect(pageSource).toContain("locale: \"ja_JP\"");
    expect(pageSource).toContain("/og/10-gaussian-splat-explorer.png");
    expect(pageSource).toContain("summary_large_image");
    expect(pageSource).toContain("OG_IMAGE_ALT");
  });

  it("uses a real 1200 by 630 PNG OGP asset", () => {
    expect(ogImage.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(ogImage.readUInt32BE(16)).toBe(1200);
    expect(ogImage.readUInt32BE(20)).toBe(630);
  });

  it("formats runtime metadata from actual values", () => {
    expect(formatFileSize(13_242_688)).toBe("13.24 MB");
    expect(createRuntimeMetadata(978_285, "WebGPU")).toEqual({
      version: "SPZ v4",
      splatCount: 978_285,
      renderer: "WebGPU",
      fileSize: "13.24 MB",
    });
  });
});
