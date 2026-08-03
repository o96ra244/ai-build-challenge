import { describe, expect, it } from "vitest";

import {
  calculateAvailableWidth,
  calculateBreakpoints,
  calculateCapacity,
  calculateEmptyTrackCount,
  calculateGridResult,
  calculateMaximumGridWidth,
  calculateTrackCount,
  FIELD_DEFINITIONS,
  formatNumber,
  generateCss,
  generateHtml,
  INITIAL_SETTINGS,
  parseIntegerString,
  validateIntegerInput,
} from "./grid";

describe("integer input", () => {
  it.each([
    ["42", 42], ["0", 0], [" 42 ", 42], ["", null], ["   ", null],
    ["-1", null], ["1.5", null], ["1e2", null], ["12px", null], ["NaN", null], ["Infinity", null],
  ])("%jを厳密に解析する", (raw, expected) => {
    expect(parseIntegerString(raw)).toBe(expected);
  });

  it.each(Object.entries(FIELD_DEFINITIONS))("%sの境界値を検証する", (_name, definition) => {
    expect(validateIntegerInput(String(definition.minimum), definition)).toEqual({ valid: true, value: definition.minimum });
    expect(validateIntegerInput(String(definition.maximum), definition)).toEqual({ valid: true, value: definition.maximum });
    expect(validateIntegerInput(String(definition.minimum - 1), definition).valid).toBe(false);
    expect(validateIntegerInput(String(definition.maximum + 1), definition).valid).toBe(false);
  });

  it("空欄と不正形式に具体的なエラーを返す", () => {
    expect(validateIntegerInput("", FIELD_DEFINITIONS.gap)).toEqual({ valid: false, error: "カード間の余白を入力してください。" });
    expect(validateIntegerInput("1.5", FIELD_DEFINITIONS.gap)).toEqual({ valid: false, error: "カード間の余白は0〜120の整数で入力してください。" });
  });
});

describe("grid calculations", () => {
  it.each([
    [{ minimumCardWidth: 240, gap: 24, maximumColumns: 4 }, 1032],
    [{ minimumCardWidth: 240, gap: 24, maximumColumns: 1 }, 240],
    [{ minimumCardWidth: 240, gap: 0, maximumColumns: 4 }, 960],
    [{ minimumCardWidth: 120, gap: 120, maximumColumns: 8 }, 1800],
    [{ minimumCardWidth: 300, gap: 20, maximumColumns: 3 }, 940],
  ])("最大グリッド幅を計算する", (settings, expected) => {
    expect(calculateMaximumGridWidth(settings)).toBe(expected);
  });

  it("初期auto-fitではカード数までの切り替わり幅を返す", () => {
    expect(calculateBreakpoints(INITIAL_SETTINGS)).toEqual([
      { columns: 2, requiredGridWidth: 504, requiredOuterWidth: 536 },
      { columns: 3, requiredGridWidth: 768, requiredOuterWidth: 800 },
    ]);
  });

  it("auto-fillでは最大列数まで既存の必要幅を維持する", () => {
    expect(calculateBreakpoints({ ...INITIAL_SETTINGS, mode: "auto-fill" })).toEqual([
      { columns: 2, requiredGridWidth: 504, requiredOuterWidth: 536 },
      { columns: 3, requiredGridWidth: 768, requiredOuterWidth: 800 },
      { columns: 4, requiredGridWidth: 1032, requiredOuterWidth: 1064 },
    ]);
  });

  it("auto-fitでカード1枚なら切り替わり幅を返さない", () => {
    expect(calculateBreakpoints({ ...INITIAL_SETTINGS, cardCount: 1 })).toEqual([]);
  });

  it("auto-fitでカード数が最大列数以上なら最大列数まで返す", () => {
    expect(calculateBreakpoints({ ...INITIAL_SETTINGS, cardCount: 4 }).map(({ columns }) => columns)).toEqual([2, 3, 4]);
  });

  it("auto-fillではカード1枚でも最大列数まで返す", () => {
    expect(calculateBreakpoints({ ...INITIAL_SETTINGS, cardCount: 1, mode: "auto-fill" }).map(({ columns }) => columns)).toEqual([2, 3, 4]);
  });

  it.each([[390, 1], [535, 1], [536, 2], [800, 3], [1064, 4], [1440, 4]])("幅%ipxで%i列になる", (width, columns) => {
    expect(calculateGridResult(INITIAL_SETTINGS, width).capacity).toBe(columns);
  });

  it("最大幅、余白0、gap 0、最小幅未満を扱う", () => {
    expect(calculateGridResult(INITIAL_SETTINGS, 1440).availableWidth).toBe(1032);
    expect(calculateAvailableWidth(390, 0, 1000)).toBe(390);
    expect(calculateCapacity(720, 240, 0, 4)).toBe(3);
    expect(calculateGridResult(INITIAL_SETTINGS, 320).cardWidth).toBe(288);
  });

  it("auto-fitではカード数までのトラックを広げる", () => {
    expect(calculateGridResult(INITIAL_SETTINGS, 1200)).toMatchObject({ capacity: 4, trackCount: 3, emptyTrackCount: 0, cardWidth: 328 });
  });

  it("auto-fillでは空きトラックを残す", () => {
    expect(calculateGridResult({ ...INITIAL_SETTINGS, mode: "auto-fill" }, 1200)).toMatchObject({ capacity: 4, trackCount: 4, emptyTrackCount: 1, cardWidth: 240 });
  });

  it.each([[1, 1], [3, 3], [4, 4], [12, 4]])("カード数%iのauto-fitトラック数を求める", (cards, tracks) => {
    expect(calculateTrackCount(4, cards, "auto-fit")).toBe(tracks);
  });

  it("空きトラックはauto-fillでだけ返す", () => {
    expect(calculateEmptyTrackCount(4, 1, "auto-fill")).toBe(3);
    expect(calculateEmptyTrackCount(4, 4, "auto-fill")).toBe(0);
    expect(calculateEmptyTrackCount(4, 12, "auto-fill")).toBe(0);
    expect(calculateEmptyTrackCount(4, 1, "auto-fit")).toBe(0);
  });
});

describe("formatNumber", () => {
  it.each([[12, "12"], [12.5, "12.5"], [12.345, "12.35"], [12.3, "12.3"], [-0, "0"], [0.004, "0"]])("%sを%sに整形する", (value, expected) => {
    expect(formatNumber(value)).toBe(expected);
  });
});

describe("code generation", () => {
  it.each(["auto-fit", "auto-fill"] as const)("%sのCSSを生成する", (mode) => {
    const css = generateCss({ ...INITIAL_SETTINGS, mode });
    expect(css).toContain(`repeat(${mode}, minmax(min(100%, var(--card-min-width)), 1fr))`);
    expect(css).toContain("--card-min-width: 240px");
    expect(css).toContain("--card-gap: 24px");
    expect(css).toContain("padding-inline: 16px");
    expect(css).toContain("max-width: 1032px");
    expect(css).not.toMatch(/NaN|Infinity/);
  });

  it.each([1, 12])("%i枚のHTMLを生成する", (cardCount) => {
    const html = generateHtml(cardCount);
    expect(html.match(/<article /g)).toHaveLength(cardCount);
    expect(html).toContain("Card 1</article>");
    expect(html).toContain(`Card ${cardCount}</article>`);
    expect(html).toContain("</div>\n</div>");
    expect(new Set(html.match(/Card \d+/g))).toHaveLength(cardCount);
  });
});
