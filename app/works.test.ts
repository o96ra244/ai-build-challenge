import { describe, expect, it } from "vitest";

import { works } from "./works";

describe("works", () => {
  it("作品01を公開作品として登録している", () => {
    expect(works).toHaveLength(1);
    expect(works[0]).toEqual({
      number: 1,
      title: "画像比率リサイズ計算機",
      description: "元画像の縦横比を保ったまま、変更後の幅または高さを計算します。",
      href: "/works/01-aspect-ratio-resizer",
    });
  });
});
