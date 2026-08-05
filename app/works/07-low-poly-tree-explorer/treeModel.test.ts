import { describe, expect, it } from "vitest";

import {
  TREE_PARTS,
  clampExplodeProgress,
  createTreeParts,
  getAutoRotateAfterMotionPreference,
  getCameraPreset,
  getExplodeTransitionDuration,
  getExplodedPosition,
  getInitialAutoRotate,
  getOrbitDampingFactor,
  interpolateRotation,
  interpolateTuple,
  isFiniteTuple,
} from "./treeModel";

function expectFiniteTuple(tuple: readonly number[]): void {
  expect(tuple.every((value) => Number.isFinite(value))).toBe(true);
}

describe("treeModel", () => {
  it("木の構成パーツを合理的な数で生成する", () => {
    const parts = createTreeParts();
    const ids = parts.map((part) => part.id);
    const groups = new Set(parts.map((part) => part.group));

    expect(parts.length).toBeGreaterThan(0);
    expect(parts.length).toBeLessThanOrEqual(32);
    expect(new Set(ids).size).toBe(parts.length);
    expect(groups).toEqual(
      new Set(["ground", "trunk", "branch", "inner-leaf", "outer-leaf", "decoration"]),
    );
  });

  it("すべてのモデル値が有限で、距離が負にならない", () => {
    for (const part of TREE_PARTS) {
      expect(isFiniteTuple(part.initialPosition)).toBe(true);
      expect(isFiniteTuple(part.initialRotation)).toBe(true);
      expect(isFiniteTuple(part.initialScale)).toBe(true);
      expect(isFiniteTuple(part.explodeDirection)).toBe(true);
      expect(part.explodeDistance).toBeGreaterThanOrEqual(0);
      expectFiniteTuple(part.initialPosition);
      expectFiniteTuple(part.initialRotation);
      expectFiniteTuple(part.initialScale);
      expectFiniteTuple(part.explodeDirection);
    }
  });

  it("explode progressを0から1へ安全に収める", () => {
    expect(clampExplodeProgress(-1)).toBe(0);
    expect(clampExplodeProgress(0)).toBe(0);
    expect(Object.is(clampExplodeProgress(-0), -0)).toBe(false);
    expect(clampExplodeProgress(1)).toBe(1);
    expect(clampExplodeProgress(2)).toBe(1);
    expect(clampExplodeProgress(Number.NaN)).toBe(0);
    expect(clampExplodeProgress(Number.POSITIVE_INFINITY)).toBe(1);
    expect(clampExplodeProgress(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it("explode位置を初期・中間・完了で補間する", () => {
    const part = TREE_PARTS.find(({ id }) => id === "leaf-right");
    if (!part) {
      throw new Error("leaf-right is required for this test");
    }

    const initial = getExplodedPosition(part, 0);
    const middle = getExplodedPosition(part, 0.5);
    const exploded = getExplodedPosition(part, 1);

    expect(initial).toEqual(part.initialPosition);
    expect(exploded).not.toEqual(initial);
    expect(middle[0]).toBeGreaterThan(initial[0]);
    expect(middle[0]).toBeLessThan(exploded[0]);
    expectFiniteTuple(initial);
    expectFiniteTuple(middle);
    expectFiniteTuple(exploded);
    expect(getExplodedPosition(part, -100)).toEqual(initial);
    expect(getExplodedPosition(part, 100)).toEqual(exploded);
  });

  it("不正な距離と回転値を補間しても有限値を返す", () => {
    expect(
      interpolateTuple([1, 2, 3], [1, 0, 0], Number.NaN, Number.NaN),
    ).toEqual([1, 2, 3]);
    expectFiniteTuple(interpolateRotation([0, 0, 0], [1, 2, 3], Number.POSITIVE_INFINITY));
  });

  it("PCとモバイルのカメラプリセットを有限値で返す", () => {
    const desktop = getCameraPreset(1440, 900);
    const mobile = getCameraPreset(390, 844);

    expect(desktop.fov).toBeLessThan(mobile.fov);
    expect(desktop.minDistance).toBeLessThan(desktop.maxDistance);
    expect(mobile.minDistance).toBeLessThan(mobile.maxDistance);
    expectFiniteTuple(desktop.position);
    expectFiniteTuple(desktop.target);
    expectFiniteTuple(mobile.position);
    expectFiniteTuple(mobile.target);
    expectFiniteTuple(getCameraPreset(Number.NaN, Number.POSITIVE_INFINITY).position);
  });

  it("reduced-motionでは自動回転と遷移時間を抑える", () => {
    expect(getInitialAutoRotate(true)).toBe(false);
    expect(getInitialAutoRotate(false)).toBe(true);
    expect(getOrbitDampingFactor(true)).toBe(0.14);
    expect(getOrbitDampingFactor(false)).toBe(0.08);
    expect(getExplodeTransitionDuration(true)).toBeLessThan(
      getExplodeTransitionDuration(false),
    );
    expect(getExplodeTransitionDuration(true)).toBe(90);
    expect(getExplodeTransitionDuration(false)).toBe(760);
    expect(Number.isFinite(getOrbitDampingFactor(true))).toBe(true);
    expect(Number.isFinite(getOrbitDampingFactor(false))).toBe(true);
  });

  it("reduced-motionを解除しても自動回転を勝手に再開しない", () => {
    const stopped = getAutoRotateAfterMotionPreference(true, true);

    expect(stopped).toBe(false);
    expect(getAutoRotateAfterMotionPreference(false, stopped)).toBe(false);
    expect(getAutoRotateAfterMotionPreference(false, true)).toBe(true);
  });
});
