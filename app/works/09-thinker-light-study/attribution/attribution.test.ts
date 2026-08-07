import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const pagePath = path.join(process.cwd(), "app/works/09-thinker-light-study/attribution/page.tsx");

describe("The Thinker attribution page", () => {
  it("publishes the source, license, and web modification notice", () => {
    const page = fs.readFileSync(pagePath, "utf8");

    expect(page).toContain("Work");
    expect(page).toContain("Original artist");
    expect(page).toContain("3D scan author");
    expect(page).toContain("Scan the World");
    expect(page).toContain("CC BY-SA 4.0");
    expect(page).toContain("Optimized for web");
    expect(page).toContain("Polygon reduction");
    expect(page).toContain("geometry cleanup");
    expect(page).toContain("normal recalculation");
    expect(page).toContain("derived STL");
    expect(page).toContain("not an official");
  });
});
