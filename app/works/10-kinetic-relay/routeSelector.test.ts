import { describe, expect, it } from "vitest";

import {
  advanceSelector,
  createSelectorState,
  getSelectorDuration,
  isSelectorMoving,
  isSelectorReady,
  startSelectorChange,
} from "./routeSelector";

describe("routeSelector", () => {
  it("starts locked on course A", () => {
    const state = createSelectorState();
    expect(state.currentCourse).toBe("A");
    expect(state.phase).toBe("settled");
    expect(state.lockEngaged).toBe(true);
    expect(isSelectorReady(state, "A")).toBe(true);
  });

  it("moves mechanically toward B and locks only after alignment", () => {
    const moving = startSelectorChange(createSelectorState("A"), "B");
    expect(moving.targetCourse).toBe("B");
    expect(moving.lockEngaged).toBe(false);
    expect(isSelectorMoving(moving)).toBe(true);

    const middle = advanceSelector(moving, 0.42).state;
    expect(middle.phase).toBe("moving");
    expect(middle.offset).toBeGreaterThan(-5.35);
    expect(middle.offset).toBeLessThan(0);
    expect(isSelectorReady(middle, "B")).toBe(false);

    const settled = advanceSelector(middle, 0.8).state;
    expect(settled.currentCourse).toBe("B");
    expect(settled.targetCourse).toBe("B");
    expect(settled.phase).toBe("settled");
    expect(settled.lockEngaged).toBe(true);
    expect(isSelectorReady(settled, "B")).toBe(true);
  });

  it("supports C and rejects same-course changes without animation", () => {
    const initial = createSelectorState("A");
    expect(startSelectorChange(initial, "A")).toEqual(initial);
    const moving = startSelectorChange(initial, "C");
    const settled = advanceSelector(moving, getSelectorDuration(false) + 0.1).state;
    expect(settled.currentCourse).toBe("C");
    expect(settled.offset).toBe(5.35);
  });

  it("shortens the selector transition under reduced motion", () => {
    expect(getSelectorDuration(true)).toBeLessThan(200 / 1000);
    expect(getSelectorDuration(true)).toBeLessThan(getSelectorDuration(false));
    const moving = startSelectorChange(createSelectorState("A"), "B");
    const settled = advanceSelector(moving, 0.2, true).state;
    expect(settled.phase).toBe("settled");
  });
});
