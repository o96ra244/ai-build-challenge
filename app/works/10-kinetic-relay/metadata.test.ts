import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const workDirectory = path.join(process.cwd(), "app/works/10-kinetic-relay");
const pageSource = fs.readFileSync(path.join(workDirectory, "page.tsx"), "utf8");
const ogImage = fs.readFileSync(path.join(process.cwd(), "public/og/10-kinetic-relay.png"));

describe("Work 10 SEO and social metadata", () => {
  it("keeps a production canonical, Open Graph card, and X large image", () => {
    expect(pageSource).toContain("https://ai-build-challenge.vercel.app/works/10-kinetic-relay");
    expect(pageSource).toContain("/og/10-kinetic-relay.png");
    expect(pageSource).toContain('type: "website"');
    expect(pageSource).toContain('locale: "ja_JP"');
    expect(pageSource).toContain('card: "summary_large_image"');
    expect(pageSource).toContain("alt: OG_IMAGE_ALT");
  });

  it("keeps the OGP image as a 1200x630 PNG", () => {
    expect(ogImage.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(ogImage.readUInt32BE(16)).toBe(1200);
    expect(ogImage.readUInt32BE(20)).toBe(630);
  });
});
