import { describe, expect, it } from "vitest";

import {
  CABIN_MODULES,
  FRONT_MODULES,
  INITIAL_SELECTION,
  MODULES_BY_CATEGORY,
  REAR_MODULES,
  ROVER_MODULES,
  clampDeltaSeconds,
  clampProgress,
  getAutoRotateAfterMotionPreference,
  getCameraPreset,
  getCombinationCount,
  getCourseDriveState,
  getCourseDuration,
  getInitialAutoRotate,
  getModuleTransitionDuration,
  getModuleTransitionTransform,
  getOrbitDampingFactor,
  getSelectionLabel,
  getWheelRotation,
  isFiniteTuple,
  normalizeSelection,
  updateSelection,
} from "./roverModel";

function expectFiniteTuple(tuple: readonly number[]): void {
  expect(tuple.every((value) => Number.isFinite(value))).toBe(true);
  expect(tuple.some((value) => Object.is(value, -0))).toBe(false);
}

describe("roverModel", () => {
  it("各カテゴリに4種類ずつのモジュールを定義する", () => {
    expect(FRONT_MODULES).toHaveLength(4);
    expect(CABIN_MODULES).toHaveLength(4);
    expect(REAR_MODULES).toHaveLength(4);
    expect(ROVER_MODULES).toHaveLength(12);
    expect(new Set(FRONT_MODULES.map((module) => module.id)).size).toBe(4);
    expect(new Set(CABIN_MODULES.map((module) => module.id)).size).toBe(4);
    expect(new Set(REAR_MODULES.map((module) => module.id)).size).toBe(4);
    expect(getCombinationCount()).toBe(64);
  });

  it("全モジュールの変換値と取付位置が有限値である", () => {
    for (const definition of ROVER_MODULES) {
      expect(definition.category in MODULES_BY_CATEGORY).toBe(true);
      expect(isFiniteTuple(definition.mountPosition)).toBe(true);
      expect(isFiniteTuple(definition.mountRotation)).toBe(true);
      expect(isFiniteTuple(definition.mountScale)).toBe(true);
      expect(isFiniteTuple(definition.transitionDirection)).toBe(true);
      expectFiniteTuple(definition.mountPosition);
      expectFiniteTuple(definition.mountRotation);
      expectFiniteTuple(definition.mountScale);
      expectFiniteTuple(definition.transitionDirection);
    }
  });

  it("初期選択は実在する3モジュールを指す", () => {
    expect(normalizeSelection(INITIAL_SELECTION)).toEqual(INITIAL_SELECTION);
    expect(getSelectionLabel(INITIAL_SELECTION)).toBe("ツインランプ / バブルキャノピー / カーゴラック");
  });

  it("不正な選択を初期値へ戻し、カテゴリ変更を分離する", () => {
    expect(normalizeSelection({ front: "unknown", cabin: "open-cockpit", rear: "bad" })).toEqual({
      front: "twin-lamp",
      cabin: "open-cockpit",
      rear: "cargo-rack",
    });
    expect(updateSelection(INITIAL_SELECTION, "front", "drill-nose")).toEqual({
      front: "drill-nose",
      cabin: "bubble-canopy",
      rear: "cargo-rack",
    });
    expect(updateSelection(INITIAL_SELECTION, "rear", "unknown")).toEqual(INITIAL_SELECTION);
  });

  it("モジュール遷移の境界値を有限な値へ収める", () => {
    const definition = FRONT_MODULES[1];
    const enterStart = getModuleTransitionTransform(definition, 0, "enter");
    const enterEnd = getModuleTransitionTransform(definition, 1, "enter");
    const exitEnd = getModuleTransitionTransform(definition, 1, "exit");

    expect(enterStart.position).not.toEqual(definition.mountPosition);
    expect(enterEnd.position).toEqual(definition.mountPosition);
    expect(exitEnd.position).not.toEqual(definition.mountPosition);
    for (const progress of [-1, 0, 0.5, 1, 2, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const transform = getModuleTransitionTransform(definition, progress, "enter");
      expectFiniteTuple(transform.position);
      expectFiniteTuple(transform.scale);
    }
    expect(getModuleTransitionDuration(true)).toBeGreaterThanOrEqual(60);
    expect(getModuleTransitionDuration(true)).toBeLessThanOrEqual(100);
    expect(getModuleTransitionDuration(false)).toBeGreaterThanOrEqual(350);
    expect(getModuleTransitionDuration(false)).toBeLessThanOrEqual(500);
    expect(clampProgress(-0)).toBe(0);
    expect(Object.is(clampProgress(-0), -0)).toBe(false);
    expect(clampProgress(Number.NaN)).toBe(0);
    expect(clampProgress(Number.POSITIVE_INFINITY)).toBe(1);
    expect(clampProgress(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it("TEST COURSEは閉じた1周の経路と車体姿勢を返す", () => {
    const normalStart = getCourseDriveState(0, false);
    const normalMiddle = getCourseDriveState(0.5, false);
    const normalEnd = getCourseDriveState(1, false);
    const reducedMiddle = getCourseDriveState(0.5, true);

    expect(normalEnd.position).toEqual(normalStart.position);
    expect(normalEnd.rotation).toEqual(normalStart.rotation);
    expect(normalEnd.travel).toBeGreaterThan(normalMiddle.travel);
    expect(normalStart.dustIntensity).toBeGreaterThan(0);
    expect(reducedMiddle.dustIntensity).toBe(0);
    expect(Math.abs(normalMiddle.position[1])).toBeGreaterThan(Math.abs(reducedMiddle.position[1]));
    for (const progress of [-1, 0, 0.25, 0.5, 0.75, 1, 2, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const state = getCourseDriveState(progress, false);
      expectFiniteTuple(state.position);
      expectFiniteTuple(state.rotation);
      expect(Number.isFinite(state.travel)).toBe(true);
      expect(Number.isFinite(state.dustIntensity)).toBe(true);
      expect(Object.is(state.dustIntensity, -0)).toBe(false);
    }
    expect(getCourseDuration(true)).toBeGreaterThanOrEqual(1200);
    expect(getCourseDuration(true)).toBeLessThanOrEqual(1800);
    expect(getCourseDuration(false)).toBeGreaterThanOrEqual(7000);
    expect(getCourseDuration(false)).toBeLessThanOrEqual(9000);
  });

  it("移動距離から車輪回転量を安全に求める", () => {
    expect(getWheelRotation(0, 0.8)).toBe(0);
    expect(getWheelRotation(1.6, 0.8)).toBe(2);
    expect(getWheelRotation(-1.6, 0.8)).toBe(-2);
    expect(getWheelRotation(1, 0)).toBe(0);
    expect(getWheelRotation(1, -1)).toBe(0);
    expect(getWheelRotation(Number.NaN, 1)).toBe(0);
    expect(getWheelRotation(Number.POSITIVE_INFINITY, 1)).toBe(0);
  });

  it("delta timeを最大値へ制限する", () => {
    expect(clampDeltaSeconds(0)).toBe(0);
    expect(clampDeltaSeconds(0.01)).toBe(0.01);
    expect(clampDeltaSeconds(1)).toBe(0.05);
    expect(clampDeltaSeconds(Number.NaN)).toBe(0);
    expect(clampDeltaSeconds(Number.POSITIVE_INFINITY)).toBe(0.05);
    expect(clampDeltaSeconds(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(Object.is(clampDeltaSeconds(-0), -0)).toBe(false);
  });

  it("カメラプリセットとmotion preferenceを安全に返す", () => {
    const desktop = getCameraPreset("garage", 1440, 900);
    const mobile = getCameraPreset("garage", 390, 844);
    const course = getCameraPreset("course", 1440, 900);
    const narrow = getCameraPreset("garage", 1, 1);
    const invalid = getCameraPreset("course", 0, Number.POSITIVE_INFINITY);

    expect(desktop.fov).toBeLessThan(mobile.fov);
    expect(course.fov).toBeGreaterThan(desktop.fov);
    expect(course.target).toEqual([0, 0.1, 0]);
    for (const preset of [desktop, mobile, course, narrow, invalid]) {
      expectFiniteTuple(preset.position);
      expectFiniteTuple(preset.target);
      expect(Number.isFinite(preset.fov)).toBe(true);
      expect(preset.minDistance).toBeLessThan(preset.maxDistance);
    }
    expect(getInitialAutoRotate(true)).toBe(false);
    expect(getInitialAutoRotate(false)).toBe(true);
    expect(getAutoRotateAfterMotionPreference(true, true)).toBe(false);
    expect(getAutoRotateAfterMotionPreference(false, false)).toBe(false);
    expect(getAutoRotateAfterMotionPreference(false, true)).toBe(true);
    expect(getOrbitDampingFactor(true)).toBeGreaterThan(getOrbitDampingFactor(false));
  });
});
