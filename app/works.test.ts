import { describe, expect, it } from "vitest";

import { works } from "./works";

describe("works", () => {
  it("作品を番号順に8件登録している", () => {
    expect(works).toHaveLength(8);
    expect(works.map((work) => work.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
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

  it("作品04を登録している", () => {
    expect(works[3]).toEqual({
      number: 4,
      title: "ポモドーロ・ミニ",
      description: "作業時間と休憩時間を設定し、集中と休憩を切り替えます。",
      href: "/works/04-pomodoro-mini",
    });
  });

  it("作品05を登録している", () => {
    expect(works[4]).toEqual({
      number: 5,
      title: "レスポンシブカードグリッド設計ツール",
      description:
        "カードの最小幅や余白から、画面幅ごとの列数とCSS Gridコードを生成します。",
      href: "/works/05-responsive-grid-planner",
    });
  });

  it("作品06を登録している", () => {
    expect(works[5]).toEqual({
      number: 6,
      title: "SVG Motion Studio",
      description:
        "SVG本体を変更せず、内蔵または任意のSVGへ用途別CSSアニメーションを設定・生成します。",
      href: "/works/06-svg-motion-studio",
    });
  });

  it("作品07を登録している", () => {
    expect(works[6]).toEqual({
      number: 7,
      title: "Low Poly Tree Explorer",
      description: "低ポリゴンの3Dツリーを回転・ズーム・分解表示して触って楽しめるインタラクティブ作品です。",
      href: "/works/07-low-poly-tree-explorer",
    });
  });

  it("作品08を登録している", () => {
    expect(works[7]).toEqual({
      number: 8,
      title: "Low Poly Rover Garage",
      description: "12種類の低ポリ部品を組み替え、64通りのローバーで広いDIRT TRIALを走れます。",
      href: "/works/08-low-poly-rover-garage",
    });
  });

  it("作品番号とhrefに重複がない", () => {
    expect(new Set(works.map((work) => work.number)).size).toBe(works.length);
    expect(new Set(works.map((work) => work.href)).size).toBe(works.length);
  });
});
