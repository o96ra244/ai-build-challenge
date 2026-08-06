import { describe, expect, it } from "vitest";

import {
  EMPTY_PRESSED_KEYS,
  getDriveInputFromPressed,
  getPlanarDot,
  getSemanticAxes,
  mapDriveKey,
  sanitizeDriveInput,
  setPressedDriveKey,
} from "./driveModel";

describe("driveModel", () => {
  it("maps keyboard controls and keeps the semantic steering sign explicit", () => {
    expect(mapDriveKey("w")).toBe("throttle-forward");
    expect(mapDriveKey("ArrowDown")).toBe("throttle-reverse");
    expect(mapDriveKey("a")).toBe("steer-left");
    expect(mapDriveKey("ARROWRIGHT")).toBe("steer-right");
    expect(mapDriveKey("p")).toBe("pause");
    expect(mapDriveKey("r")).toBe("reset");
    expect(mapDriveKey("x")).toBeNull();
  });

  it("supports accelerator plus either steering input and cancels opposing input", () => {
    const pressed = setPressedDriveKey(
      setPressedDriveKey(EMPTY_PRESSED_KEYS, "throttle-forward", true),
      "steer-left",
      true,
    );
    expect(getDriveInputFromPressed(pressed)).toEqual({ throttle: 1, steering: -1 });
    expect(getDriveInputFromPressed({
      throttleForward: true,
      throttleReverse: true,
      steerLeft: true,
      steerRight: true,
    })).toEqual({ throttle: 0, steering: 0 });
  });

  it("clears invalid values so NaN cannot enter the physics input model", () => {
    expect(sanitizeDriveInput({ throttle: Number.NaN as 1, steering: Number.NaN as -1 })).toEqual({ throttle: 0, steering: 0 });
    expect(sanitizeDriveInput({ throttle: 1, steering: -1 })).toEqual({ throttle: 1, steering: -1 });
  });

  it("uses local -Z as forward and local +X as right", () => {
    const axes = getSemanticAxes({ x: 0, y: 0, z: 0, w: 1 });
    expect(axes.forward).toEqual([0, 0, -1]);
    expect(axes.right).toEqual([1, 0, 0]);
    expect(getPlanarDot([2, 0, -4], axes.right)).toBe(2);
    expect(getPlanarDot([-2, 0, -4], axes.right)).toBe(-2);
  });
});
