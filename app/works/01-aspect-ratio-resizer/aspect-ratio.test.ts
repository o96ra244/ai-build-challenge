import { describe, expect, it } from "vitest";

import {
  calculateResizedDimensions,
  formatAspectRatio,
  greatestCommonDivisor,
  simplifyAspectRatio,
  validatePixelValue,
} from "./aspect-ratio";

describe("calculateResizedDimensions", () => {
  it.each([
    ["幅基準", { width: 1920, height: 1080 }, "width", 1280, { width: 1280, height: 720 }],
    ["高さ基準", { width: 1200, height: 800 }, "height", 300, { width: 450, height: 300 }],
    ["正方形", { width: 1000, height: 1000 }, "width", 500, { width: 500, height: 500 }],
    ["四捨五入", { width: 1000, height: 667 }, "width", 333, { width: 333, height: 222 }],
    ["縦長画像", { width: 800, height: 1200 }, "height", 600, { width: 400, height: 600 }],
  ] as const)("%sのサイズを計算する", (_name, original, basis, target, expected) => {
    expect(calculateResizedDimensions(original, basis, target)).toEqual(expected);
  });

  it("計算結果を最低1pxにする", () => {
    expect(calculateResizedDimensions({ width: 100_000, height: 1 }, "width", 1)).toEqual({
      width: 1,
      height: 1,
    });
  });
});

describe("simplifyAspectRatio", () => {
  it.each([
    [{ width: 1920, height: 1080 }, "16 : 9"],
    [{ width: 1200, height: 800 }, "3 : 2"],
    [{ width: 1000, height: 1000 }, "1 : 1"],
    [{ width: 17, height: 13 }, "17 : 13"],
  ])("%oを簡約する", (dimensions, expected) => {
    expect(formatAspectRatio(simplifyAspectRatio(dimensions))).toBe(expected);
  });

  it("ユークリッドの互除法で最大公約数を求める", () => {
    expect(greatestCommonDivisor(1920, 1080)).toBe(120);
  });
});

describe("validatePixelValue", () => {
  it.each([
    ["", false],
    ["0", false],
    ["-1", false],
    ["1.5", false],
    ["abc", false],
    ["100000", true],
    ["100001", false],
    [" 42 ", true],
  ])("入力 %j の有効性を判定する", (value, expected) => {
    expect(validatePixelValue(value, "元の幅").valid).toBe(expected);
  });

  it("前後の空白を除いた整数を返す", () => {
    expect(validatePixelValue(" 42 ", "元の幅")).toEqual({ valid: true, value: 42 });
  });

  it("空欄の理由を示す", () => {
    expect(validatePixelValue("", "元の幅")).toEqual({
      valid: false,
      error: "元の幅を入力してください。",
    });
  });

  it("小数の理由と有効範囲を示す", () => {
    expect(validatePixelValue("1.5", "変更後の幅")).toEqual({
      valid: false,
      error: "変更後の幅は小数ではなく1〜100000の整数で入力してください。",
    });
  });
});
