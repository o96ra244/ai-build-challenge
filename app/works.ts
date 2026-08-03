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
];
