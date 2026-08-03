import { describe, expect, it } from "vitest";

import {
  analyzeText,
  countGraphemes,
  countLines,
  formatReadingTime,
  removeWhitespace,
} from "./text-metrics";

describe("countGraphemes", () => {
  it.each([
    ["空文字", "", 0],
    ["日本語", "こんにちは", 5],
    ["半角英数字", "abc123", 6],
    ["半角スペース", "A B", 3],
    ["全角スペース", "A　B", 3],
    ["タブ", "A\tB", 3],
    ["LF", "A\nB", 3],
    ["CRLF", "A\r\nB", 3],
    ["CR", "A\rB", 3],
    ["ノーブレークスペース", "A\u00a0B", 3],
    ["絵文字", "😀", 1],
    ["ZWJを含む絵文字", "👨‍👩‍👧‍👦", 1],
    ["結合文字", "e\u0301", 1],
  ])("%sをgrapheme単位で数える", (_name, text, expected) => {
    expect(countGraphemes(text)).toBe(expected);
  });

  it("Unicode空白をすべて除外する", () => {
    const text = "A B　C\tD\nE\r\nF\rG\u00a0H";

    expect(removeWhitespace(text)).toBe("ABCDEFGH");
    expect(analyzeText(text)).toMatchObject({
      charactersWithWhitespace: 15,
      charactersWithoutWhitespace: 8,
    });
  });
});

describe("countLines", () => {
  it.each([
    ["空文字", "", 0],
    ["改行なし", "A", 1],
    ["LF", "A\nB", 2],
    ["CRLF", "A\r\nB", 2],
    ["CR", "A\rB", 2],
    ["末尾改行", "A\n", 2],
    ["空行", "A\n\nB", 3],
  ])("%sの行数を数える", (_name, text, expected) => {
    expect(countLines(text)).toBe(expected);
  });
});

describe("formatReadingTime", () => {
  it.each([
    [0, "—"],
    [1, "1分未満"],
    [499, "1分未満"],
    [500, "約1分"],
    [501, "約2分"],
    [1000, "約2分"],
    [1001, "約3分"],
  ])("%i文字を%sと表示する", (count, expected) => {
    expect(formatReadingTime(count)).toBe(expected);
  });
});

describe("analyzeText", () => {
  it("全指標を一度に返す", () => {
    expect(analyzeText("日本語 A\n")).toEqual({
      charactersWithWhitespace: 6,
      charactersWithoutWhitespace: 4,
      lines: 2,
      readingTime: "1分未満",
    });
  });
});
