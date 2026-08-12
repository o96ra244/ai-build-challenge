import { describe, expect, it } from "vitest";

import { BODY_LAYOUT, FUNCTIONAL_LAYOUT } from "./deskLayout";

describe("deskLayout", () => {
  it("keeps functional visible and collider transforms in one definition", () => {
    expect(FUNCTIONAL_LAYOUT.redRamp.position).toEqual([-3.15, 1.34, -1.1]);
    expect(FUNCTIONAL_LAYOUT.redRamp.rotation).toEqual([0, 0, -0.44]);
    expect(FUNCTIONAL_LAYOUT.carRamp.size).toEqual([3.15, 0.22, 1.28]);
  });

  it("keeps the visible dynamic object roster explicit", () => {
    expect(BODY_LAYOUT.blocks).toHaveLength(7);
    expect(BODY_LAYOUT.redMarble.radius).toBeGreaterThan(0);
    expect(BODY_LAYOUT.blueMarble.radius).toBeGreaterThan(0);
  });
});
