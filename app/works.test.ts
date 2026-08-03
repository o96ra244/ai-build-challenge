import { describe, expect, it } from "vitest";

import { works } from "./works";

describe("works", () => {
  it("公開前は作品が0件である", () => {
    expect(works).toHaveLength(0);
  });
});
