import { describe, expect, it } from "vitest";

import { works } from "./works";

describe("works", () => {
  it("作品を番号順に2件登録している", () => {
    expect(works).toHaveLength(2);
    expect(works.map((work) => work.number)).toEqual([1, 2]);
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
});
