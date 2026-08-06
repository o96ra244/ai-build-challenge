export type Work = {
  number: number;
  title: string;
  description: string;
  href: `/works/${string}`;
};

export const works: readonly Work[] = [
  {
    number: 1,
    title: "画像比率リサイズ計算機",
    description: "元画像の縦横比を保ったまま、変更後の幅または高さを計算します。",
    href: "/works/01-aspect-ratio-resizer",
  },
  {
    number: 2,
    title: "文字数・読了時間カウンター",
    description: "文章の文字数、行数、日本語の概算読了時間を確認します。",
    href: "/works/02-text-length-counter",
  },
  {
    number: 3,
    title: "WCAGコントラストチェッカー",
    description: "2色のコントラスト比とWCAG 2.2の適合目安を確認します。",
    href: "/works/03-wcag-contrast-checker",
  },
  {
    number: 4,
    title: "ポモドーロ・ミニ",
    description: "作業時間と休憩時間を設定し、集中と休憩を切り替えます。",
    href: "/works/04-pomodoro-mini",
  },
  {
    number: 5,
    title: "レスポンシブカードグリッド設計ツール",
    description:
      "カードの最小幅や余白から、画面幅ごとの列数とCSS Gridコードを生成します。",
    href: "/works/05-responsive-grid-planner",
  },
  {
    number: 6,
    title: "SVG Motion Studio",
    description:
      "SVG本体を変更せず、内蔵または任意のSVGへ用途別CSSアニメーションを設定・生成します。",
    href: "/works/06-svg-motion-studio",
  },
  {
    number: 7,
    title: "Low Poly Tree Explorer",
    description: "低ポリゴンの3Dツリーを回転・ズーム・分解表示して触って楽しめるインタラクティブ作品です。",
    href: "/works/07-low-poly-tree-explorer",
  },
  {
    number: 8,
    title: "Low Poly Rover Garage",
    description: "12モジュールをGARAGEで組み替え、小さなTEST YARDで坂・障害物・ジャンプの走行感を試せます。",
    href: "/works/08-low-poly-rover-garage",
  },
];
