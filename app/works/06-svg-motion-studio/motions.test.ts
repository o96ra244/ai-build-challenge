import { describe, expect, it } from "vitest";
import { MOTIONS, motionsForPurpose, PURPOSES, SETTING_RANGES } from "./motions";

describe("motion definitions", () => {
  it("重複しない12モーションを定義する", () => { expect(MOTIONS).toHaveLength(12); expect(new Set(MOTIONS.map((motion) => motion.id)).size).toBe(12); });
  it("全用途に候補がある", () => PURPOSES.forEach((purpose) => expect(motionsForPurpose(purpose.id).length).toBeGreaterThan(0)));
  it("全モーションに範囲内の初期値がある", () => MOTIONS.forEach((motion) => { expect(motion.defaults.duration).toBeGreaterThanOrEqual(SETTING_RANGES.duration.min); expect(motion.defaults.duration).toBeLessThanOrEqual(SETTING_RANGES.duration.max); expect(motion.defaults.delay).toBeGreaterThanOrEqual(SETTING_RANGES.delay.min); }));
  it("infiniteをSpinとFloatだけに許可する", () => expect(MOTIONS.filter((motion) => motion.allowInfinite).map((motion) => motion.id)).toEqual(["spin", "float"]));
  it("範囲のmin、default、maxが矛盾しない", () => Object.values(SETTING_RANGES).forEach((range) => { expect(range.min).toBeLessThanOrEqual(range.default); expect(range.default).toBeLessThanOrEqual(range.max); }));
});
