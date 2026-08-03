import { describe, expect, it } from "vitest";

import {
  formatContrastRatio,
  getContrastCriteria,
  getContrastRatio,
  getRelativeLuminance,
  linearizeSrgb,
  normalizeHex,
  passesRatio,
} from "./contrast";

describe("normalizeHex", () => {
  it.each([
    ["#000", "#000000"],
    ["#fff", "#FFFFFF"],
    ["#a1b2c3", "#A1B2C3"],
    ["#AbC123", "#ABC123"],
  ])("%sを%sへ正規化する", (input, expected) => {
    expect(normalizeHex(input)).toEqual({ valid: true, value: expected });
  });

  it.each(["", "fff", "#12", "#1234", "#12345", "#12345678", "#12G", "#FFFFFG"])(
    "対応外の入力 %j を拒否する",
    (input) => {
      expect(normalizeHex(input).valid).toBe(false);
    },
  );

  it("入力ごとに具体的なラベルを含める", () => {
    expect(normalizeHex("", "前景色")).toEqual({
      valid: false,
      error: "前景色を入力してください。",
    });
  });
});

describe("相対輝度とコントラスト比", () => {
  it("黒と白の比率を21:1として計算する", () => {
    expect(getContrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 12);
  });

  it("同一色の比率を1:1として計算する", () => {
    expect(getContrastRatio("#2563EB", "#2563EB")).toBeCloseTo(1, 12);
  });

  it("前景色と背景色を逆にしても同じ比率を返す", () => {
    expect(getContrastRatio("#2563EB", "#FFFFFF")).toBeCloseTo(
      getContrastRatio("#FFFFFF", "#2563EB"),
      12,
    );
  });

  it("既知の青と白の組み合わせを許容誤差付きで計算する", () => {
    expect(getContrastRatio("#2563EB", "#FFFFFF")).toBeCloseTo(5.17, 2);
  });

  it("sRGB線形化の0.04045境界で指定された分岐を使用する", () => {
    expect(linearizeSrgb(0.04045)).toBeCloseTo(0.04045 / 12.92, 12);
    expect(linearizeSrgb(0.040451)).toBeCloseTo(((0.040451 + 0.055) / 1.055) ** 2.4, 12);
  });

  it.each(["#000000", "#FFFFFF", "#2563EB", "#777777"])(
    "%sの相対輝度が有限かつ0〜1になる",
    (color) => {
      const luminance = getRelativeLuminance(color);
      expect(Number.isFinite(luminance)).toBe(true);
      expect(luminance).toBeGreaterThanOrEqual(0);
      expect(luminance).toBeLessThanOrEqual(1);
    },
  );

  it.each([
    ["#000000", "#FFFFFF"],
    ["#2563EB", "#FFFFFF"],
    ["#ABCDEF", "#123456"],
  ])("%sと%sの比率が有限かつ1〜21になる", (foreground, background) => {
    const ratio = getContrastRatio(foreground, background);
    expect(Number.isFinite(ratio)).toBe(true);
    expect(ratio).toBeGreaterThanOrEqual(1);
    expect(ratio).toBeLessThanOrEqual(21);
  });
});

describe("判定境界", () => {
  it.each([
    [2.999, 3, false],
    [3, 3, true],
    [4.499, 4.5, false],
    [4.5, 4.5, true],
    [6.999, 7, false],
    [7, 7, true],
  ])("比率%sを基準%sに対して判定する", (ratio, required, expected) => {
    expect(passesRatio(ratio, required)).toBe(expected);
  });

  it("全5基準を丸め前の比率で判定する", () => {
    expect(getContrastCriteria(4.499).map((criterion) => criterion.passed)).toEqual([
      false,
      true,
      false,
      false,
      true,
    ]);
  });
});

describe("formatContrastRatio", () => {
  it("4.499を上方向へ丸めない", () => {
    expect(formatContrastRatio(4.499)).toBe("4.49");
  });

  it("21を安定した形式で表示する", () => {
    expect(formatContrastRatio(21)).toBe("21.00");
  });

  it("表示用整形が元の値と判定を変更しない", () => {
    const ratio = 4.499;
    formatContrastRatio(ratio);
    expect(ratio).toBe(4.499);
    expect(passesRatio(ratio, 4.5)).toBe(false);
  });
});
