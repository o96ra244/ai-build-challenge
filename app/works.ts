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
];
