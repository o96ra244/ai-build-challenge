import { describe, expect, it } from "vitest";
import { INITIAL_MOTION, MOTIONS, motionsForPurpose, PURPOSES, quickSettings, SETTING_RANGES, supportsQuickTrigger } from "./motions";

describe("motion definitions", () => {
  it("重複しない12モーションを定義する", () => { expect(MOTIONS).toHaveLength(12); expect(new Set(MOTIONS.map((motion) => motion.id)).size).toBe(12); });
  it("全用途に候補がある", () => PURPOSES.forEach((purpose) => expect(motionsForPurpose(purpose.id).length).toBeGreaterThan(0)));
  it("全モーションに範囲内の初期値がある", () => MOTIONS.forEach((motion) => { expect(motion.defaults.duration).toBeGreaterThanOrEqual(SETTING_RANGES.duration.min); expect(motion.defaults.duration).toBeLessThanOrEqual(SETTING_RANGES.duration.max); expect(motion.defaults.delay).toBeGreaterThanOrEqual(SETTING_RANGES.delay.min); }));
  it("infiniteをSpinとFloatだけに許可する", () => expect(MOTIONS.filter((motion) => motion.allowInfinite).map((motion) => motion.id)).toEqual(["spin", "float"]));
  it("範囲のmin、default、maxが矛盾しない", () => Object.values(SETTING_RANGES).forEach((range) => { expect(range.min).toBeLessThanOrEqual(range.default); expect(range.default).toBeLessThanOrEqual(range.max); }));
  it("初期状態はLiftの標準速度・標準強度になる", () => expect(quickSettings(INITIAL_MOTION, "normal", "normal")).toEqual(INITIAL_MOTION.defaults));
  it("全モーションの速度と強度を設定範囲内へ正規化する", () => MOTIONS.forEach((motion) => {
    (["slow", "normal", "fast"] as const).forEach((speed) => (["subtle", "normal", "strong"] as const).forEach((strength) => {
      const settings = quickSettings(motion, speed, strength);
      expect(settings.duration).toBeGreaterThanOrEqual(SETTING_RANGES.duration.min);
      expect(settings.duration).toBeLessThanOrEqual(SETTING_RANGES.duration.max);
      expect(settings.translate).toBeGreaterThanOrEqual(SETTING_RANGES.translate.min);
      expect(settings.translate).toBeLessThanOrEqual(SETTING_RANGES.translate.max);
      expect(settings.scale).toBeGreaterThanOrEqual(SETTING_RANGES.scale.min);
      expect(settings.scale).toBeLessThanOrEqual(SETTING_RANGES.scale.max);
      expect(settings.rotation).toBeGreaterThanOrEqual(SETTING_RANGES.rotation.min);
      expect(settings.rotation).toBeLessThanOrEqual(SETTING_RANGES.rotation.max);
      expect(settings.opacity).toBeGreaterThanOrEqual(SETTING_RANGES.opacity.min);
      expect(settings.opacity).toBeLessThanOrEqual(SETTING_RANGES.opacity.max);
    }));
  }));
  it("AlwaysはSpinとFloatだけに許可する", () => MOTIONS.forEach((motion) => expect(supportsQuickTrigger(motion, "always")).toBe(["spin", "float"].includes(motion.id))));
  it("用途選択なしで全12モーションへ到達できる", () => expect(MOTIONS.map((motion) => motion.id)).toHaveLength(12));
});
