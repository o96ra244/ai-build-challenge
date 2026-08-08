import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const workDirectory = path.join(process.cwd(), "app/works/09-thinker-light-study");
const pageSource = fs.readFileSync(path.join(workDirectory, "page.tsx"), "utf8");
const ogImage = fs.readFileSync(path.join(process.cwd(), "public/og/09-thinker-light-study.png"));

describe("Work 09 SEO and social metadata", () => {
  it("keeps the production canonical and social card settings", () => {
    expect(pageSource).toContain("https://ai-build-challenge.vercel.app/works/09-thinker-light-study");
    expect(pageSource).toContain("/og/09-thinker-light-study.png");
    expect(pageSource).toContain('type: "website"');
    expect(pageSource).toContain('locale: "ja_JP"');
    expect(pageSource).toContain('card: "summary_large_image"');
    expect(pageSource).toContain("alt: OG_IMAGE_ALT");
  });

  it("keeps the published OG image as a 1200x630 PNG", () => {
    expect(ogImage.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(ogImage.readUInt32BE(16)).toBe(1200);
    expect(ogImage.readUInt32BE(20)).toBe(630);
  });
});
