import { describe, expect, it } from "vitest";

import { works } from "./works";

describe("works", () => {
  it("作品を番号順に3件登録している", () => {
    expect(works).toHaveLength(3);
    expect(works.map((work) => work.number)).toEqual([1, 2, 3]);
  });

  it("作品01の登録内容を維持している", () => {
    expect(works[0]).toEqual({
      number: 1,
      title: "画像比率リサイズ計算機",
      description: "元画像の縦横比を保ったまま、変更後の幅または高さを計算します。",
      href: "/works/01-aspect-ratio-resizer",
    });
  });

  it("作品02を登録している", () => {
    expect(works[1]).toEqual({
      number: 2,
      title: "文字数・読了時間カウンター",
      description: "文章の文字数、行数、日本語の概算読了時間を確認します。",
      href: "/works/02-text-length-counter",
    });
  });

  it("作品03を登録している", () => {
    expect(works[2]).toEqual({
      number: 3,
      title: "WCAGコントラストチェッカー",
      description: "2色のコントラスト比とWCAG 2.2の適合目安を確認します。",
      href: "/works/03-wcag-contrast-checker",
    });
  });

  it("作品番号とhrefに重複がない", () => {
    expect(new Set(works.map((work) => work.number)).size).toBe(works.length);
    expect(new Set(works.map((work) => work.href)).size).toBe(works.length);
  });
});
