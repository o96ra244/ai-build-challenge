import { describe, expect, it } from "vitest";

import { WAYSTONES } from "./frontierWorld";
import {
  activateWaystone,
  clampFrontierDeltaSeconds,
  createWaystoneRunState,
  EMPTY_PRESSED_KEYS,
  formatFrontierTime,
  getDriveInputFromPressed,
  getSpeedDisplay,
  getVisitedAreaCount,
  getWaystoneLabel,
  mapDriveKey,
  sanitizeDriveInput,
  setPressedDriveKey,
} from "./driveModel";

describe("drive input", () => {
  it("maps W/S/A/D and arrow keys with fixed left/right semantics", () => {
    expect(mapDriveKey("w")).toBe("throttle-forward");
    expect(mapDriveKey("ArrowUp")).toBe("throttle-forward");
    expect(mapDriveKey("S")).toBe("throttle-reverse");
    expect(mapDriveKey("ARROWDOWN")).toBe("throttle-reverse");
    expect(mapDriveKey("a")).toBe("steer-left");
    expect(mapDriveKey("ArrowLeft")).toBe("steer-left");
    expect(mapDriveKey("D")).toBe("steer-right");
    expect(mapDriveKey("ArrowRight")).toBe("steer-right");
    expect(mapDriveKey("R")).toBe("reset");
    expect(mapDriveKey("p")).toBe("pause");
  });

  it("keeps simultaneous input and cancels opposing directions safely", () => {
    const leftAndForward = getDriveInputFromPressed({
      ...EMPTY_PRESSED_KEYS,
      throttleForward: true,
      steerLeft: true,
    });
    expect(leftAndForward).toEqual({ throttle: 1, steering: -1 });
    expect(getDriveInputFromPressed({
      throttleForward: true,
      throttleReverse: true,
      steerLeft: true,
      steerRight: true,
    })).toEqual({ throttle: 0, steering: 0 });
  });

  it("adds and releases held keys without depending on key repeat", () => {
    const pressed = setPressedDriveKey(EMPTY_PRESSED_KEYS, "throttle-forward", true);
    expect(getDriveInputFromPressed(pressed).throttle).toBe(1);
    const released = setPressedDriveKey(pressed, "throttle-forward", false);
    expect(released).toEqual(EMPTY_PRESSED_KEYS);
    expect(sanitizeDriveInput({ throttle: 7 as 1, steering: -7 as -1 })).toEqual({ throttle: 0, steering: 0 });
  });
});

describe("waystone run", () => {
  it("accepts six waystones in any order and ignores duplicates", () => {
    let state = createWaystoneRunState();
    const first = activateWaystone(state, WAYSTONES[3], WAYSTONES.length);
    state = first.state;
    expect(first.activated).toBe(true);
    expect(state.visitedWaystoneIds).toEqual([WAYSTONES[3].id]);
    const duplicate = activateWaystone(state, WAYSTONES[3], WAYSTONES.length);
    expect(duplicate.activated).toBe(false);
    for (const waystone of [WAYSTONES[0], WAYSTONES[5], WAYSTONES[1], WAYSTONES[4], WAYSTONES[2]]) {
      state = activateWaystone(state, waystone, WAYSTONES.length).state;
    }
    expect(state.completed).toBe(true);
    expect(getVisitedAreaCount(state.visitedWaystoneIds, WAYSTONES)).toBe(6);
    expect(getWaystoneLabel(6, 6)).toBe("WAYSTONE 6 / 6");
  });
});

describe("frontier display helpers", () => {
  it("formats the timer and sanitizes hostile values", () => {
    expect(formatFrontierTime(32480)).toBe("32.48");
    expect(formatFrontierTime(72480)).toBe("1:12.48");
    expect(formatFrontierTime(Number.NaN)).toBe("0.00");
    expect(formatFrontierTime(Number.POSITIVE_INFINITY)).toBe("0.00");
    expect(getSpeedDisplay(Number.NaN)).toBe("0.0");
    expect(clampFrontierDeltaSeconds(1)).toBe(0.05);
    expect(clampFrontierDeltaSeconds(Number.NaN)).toBe(0);
    expect(Object.is(clampFrontierDeltaSeconds(-0), -0)).toBe(false);
  });
});
